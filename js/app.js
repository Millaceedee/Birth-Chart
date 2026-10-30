// Calculation adapter on top of Astronomy Engine (not Swiss Ephemeris; the API shape is only similar).
class AstroCalc {
  SEFLG_SPEED = 256;
  julday(y, m, d, h) {
    let y1 = y, m1 = m;
    if (m1 <= 2) { y1 -= 1; m1 += 12; }
    const A = Math.floor(y1 / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y1 + 4716)) + Math.floor(30.6001 * (m1 + 1)) + d + h / 24 + B - 1524.5;
  }
  #date(jd) { return new Date((jd - 2440587.5) * 864e5); }
  #lon(jd, pl) {
    const date = this.#date(jd), AE = Astronomy;
    if (pl === 10) { 
      const d = 0.02, ec = j => AE.Ecliptic(AE.GeoMoon(this.#date(j))).vec;
      const r1 = ec(jd - d), r = ec(jd), r2 = ec(jd + d);
      const v = {x: (r2.x - r1.x) / (2 * d), y: (r2.y - r1.y) / (2 * d), z: (r2.z - r1.z) / (2 * d)};
      const hx = r.y * v.z - r.z * v.y, hy = r.z * v.x - r.x * v.z;
      return ((Math.atan2(hx, -hy) * 180 / Math.PI) % 360 + 360) % 360;
    }
    const body = [AE.Body.Sun, AE.Body.Moon, AE.Body.Mercury, AE.Body.Venus, AE.Body.Mars, AE.Body.Jupiter, AE.Body.Saturn, AE.Body.Uranus, AE.Body.Neptune, AE.Body.Pluto][pl];
    const v = body === AE.Body.Moon ? AE.GeoMoon(date) : AE.GeoVector(body, date, true);
    return AE.Ecliptic(v).elon;
  }
  calc_ut(jd, pl) {
    const a = this.#lon(jd, pl), b = this.#lon(jd + 0.01, pl);
    let sp = ((b - a + 540) % 360 - 180) / 0.01;
    return [a, 0, 1, sp, 0, 0];
  }
  // Mean lunar apogee ("Black Moon Lilith"), true equinox of date.
  meanApogee(jd) {
    const T = (jd - 2451545) / 36525, AE = Astronomy;
    const peri = 83.3532465 + 4069.0137287 * T - 0.01032 * T * T - T * T * T / 80053 + T * T * T * T / 18999000;
    const dpsi = AE.e_tilt(new AE.AstroTime(this.#date(jd))).dpsi / 3600;
    return (((peri + 180 + dpsi) % 360) + 360) % 360;
  }
  // Ecliptic longitude of a fixed star (J2000 RA in hours, Dec in degrees, distance in light years), true equinox of date.
  star(jd, ra, dec, ly) {
    const AE = Astronomy;
    AE.DefineStar(AE.Body.Star1, ra, dec, ly);
    return AE.Ecliptic(AE.GeoVector(AE.Body.Star1, this.#date(jd), true)).elon;
  }
  // sys: P = Placidus, K = Koch, W = Whole Sign, E = Equal
  houses(jd, lat, lon, sys = "P") {
    const AE = Astronomy, date = this.#date(jd), R = Math.PI / 180, nm = x => ((x % 360) + 360) % 360;
    const eps = AE.e_tilt(new AE.AstroTime(date)).tobl * R;
    const ramc = nm(AE.SiderealTime(date) * 15 + lon), rm = ramc * R, phi = lat * R;
    const asc = nm(Math.atan2(Math.cos(rm), -(Math.sin(rm) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) / R);
    const mc = nm(Math.atan2(Math.tan(rm), Math.cos(eps)) / R);
    const mcF = Math.abs(nm(mc - ramc + 180) - 180) > 90 ? nm(mc + 180) : mc; // MC on the same side as RAMC
    const cusp = new Float64Array(13);
    const eclFromRA = (ra) => nm(Math.atan2(Math.sin(ra), Math.cos(ra) * Math.cos(eps)) / R);
    // Clear Placidus implementation
    const pl = (k) => {
      // k: houses 11,12,2,3; ratio 1/3 or 2/3 of the semi-arc
      let ra = ramc * R + (k === 11 ? 30 : k === 12 ? 60 : k === 2 ? 120 : 150) * R;
      for (let i = 0; i < 100; i++) {
        const lam = eclFromRA(ra) * R;
        const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
        const ad = Math.asin(Math.tan(phi) * Math.tan(dec));
        let nra;
        if (k === 11) nra = ramc * R + (Math.PI / 2 + ad) / 3;          // above the horizon
        else if (k === 12) nra = ramc * R + 2 * (Math.PI / 2 + ad) / 3;
        else if (k === 2) nra = ramc * R + Math.PI - 2 * (Math.PI / 2 - ad) / 3;  // below the horizon
        else nra = ramc * R + Math.PI - (Math.PI / 2 - ad) / 3;
        if (Math.abs(nra - ra) < 1e-10) { ra = nra; break; }
        ra = nra;
      }
      return eclFromRA(ra);
    };
    // Ascendant-type point for a given sidereal angle (deg) and latitude (rad); used by Koch and the Vertex.
    const ascAt = (rd, ph) => nm(Math.atan2(Math.cos(rd * R), -(Math.sin(rd * R) * Math.cos(eps) + Math.tan(ph) * Math.sin(eps))) / R);
    // Koch: divides the semi-arc of the MC degree into thirds.
    const koch = () => {
      const sina = Math.max(-1, Math.min(1, Math.sin(mcF * R) * Math.sin(eps) / Math.cos(phi)));
      const cosa = Math.sqrt(1 - sina * sina);
      const c = Math.atan(Math.tan(phi) / cosa);
      const ad3 = Math.asin(Math.sin(c) * sina) / R / 3;
      // The cusps are the ascendants at one third and two thirds of the MC degree's semi-arc
      // (before the birth moment for houses 11-12, after it for houses 2-3).
      cusp[11] = ascAt(ramc - 60 - 2 * ad3, phi);
      cusp[12] = ascAt(ramc - 30 - ad3, phi);
      cusp[2] = ascAt(ramc + 30 + ad3, phi);
      cusp[3] = ascAt(ramc + 60 + 2 * ad3, phi);
    };
    let ok = Math.abs(lat) < 90 - eps / R - 0.01, polar = false;
    if (sys === "W") {
      const b = Math.floor(asc / 30) * 30;
      for (let i = 1; i <= 12; i++) cusp[i] = nm(b + 30 * (i - 1));
    } else if (sys === "E") {
      for (let i = 1; i <= 12; i++) cusp[i] = nm(asc + 30 * (i - 1));
    } else {
      cusp[1] = asc; cusp[10] = mcF; cusp[4] = nm(mcF + 180); cusp[7] = nm(asc + 180);
      const porph = () => { // Porphyry: each quadrant divided into three equal parts
        const q = nm(cusp[4] - asc);
        cusp[2] = nm(asc + q / 3); cusp[3] = nm(asc + 2 * q / 3);
        const q2 = nm(asc - mcF);
        cusp[11] = nm(mcF + q2 / 3); cusp[12] = nm(mcF + 2 * q2 / 3);
        polar = true;
      };
      if (ok && sys === "K") {
        koch();
      } else if (ok) {
        cusp[11] = pl(11); cusp[12] = pl(12); cusp[2] = pl(2); cusp[3] = pl(3);
      }
      if (!ok || [11, 12, 2, 3].some(i => !isFinite(cusp[i]))) porph(); // polar regions or a failed iteration
      cusp[5] = nm(cusp[11] + 180); cusp[6] = nm(cusp[12] + 180);
      cusp[8] = nm(cusp[2] + 180); cusp[9] = nm(cusp[3] + 180);
    }
    // Vertex: where the prime vertical meets the ecliptic in the west (between IC and MC, via the Descendant).
    let vx = ascAt(ramc + 180, (90 - lat) * R);
    if (nm(vx - (mcF + 180)) > 180) vx = nm(vx + 180);
    return { cusps: cusp, ascmc: new Float64Array([asc, mcF, ramc, vx]), polar };
  }
}

const ast = new AstroCalc();
setTimeout(() => { const r = calc(); if(r){ window.RES = r; render(); } }, 0);

const DB=`FI|Europe/Helsinki|Suomi|Finland|Helsinki,60.17,24.94;Espoo,60.21,24.66;Vantaa,60.29,25.04;Tampere,61.50,23.76;Turku,60.45,22.27;Oulu,65.01,25.47;Jyväskylä,62.24,25.75;Lahti,60.98,25.66;Kuopio,62.89,27.68;Pori,61.49,21.80;Kouvola,60.87,26.70;Joensuu,62.60,29.76;Lappeenranta,61.06,28.19;Vaasa,63.10,21.62;Rovaniemi,66.50,25.73;Seinäjoki,62.79,22.84;Mikkeli,61.69,27.27;Kotka,60.47,26.95;Kemijärvi,66.71,27.43;Kittilä,67.65,24.91;Sodankylä,67.42,26.59;Ivalo,68.66,27.54;Porvoo,60.39,25.66;Kokkola,63.84,23.13;Hämeenlinna,60.99,24.46;Rauma,61.13,21.51;Kajaani,64.23,27.73;Savonlinna,61.87,28.88;Kemi,65.74,24.56;Tornio,65.85,24.15;Raahe,64.69,24.48;Salo,60.38,23.13;Hyvinkää,60.63,24.86;Järvenpää,60.47,25.09;Kerava,60.40,25.10;Nokia,61.48,23.51;Lohja,60.25,24.07;Mariehamn,60.10,19.94;Ivalo,68.66,27.54;Kuusamo,65.97,29.19;Sodankylä,67.42,26.59;Kemijärvi,66.71,27.43;Imatra,61.17,28.77;Iisalmi,63.56,27.19;Heinola,61.20,26.04
SE|Europe/Stockholm|Ruotsi|Sweden|Stockholm,59.33,18.07;Göteborg,57.71,11.97;Malmö,55.60,13.00;Uppsala,59.86,17.64;Umeå,63.83,20.26;Luleå,65.58,22.15;Kiruna,67.86,20.23;Västerås,59.61,16.55;Örebro,59.27,15.21;Linköping,58.41,15.62
NO|Europe/Oslo|Norja|Norway|Oslo,59.91,10.75;Bergen,60.39,5.32;Trondheim,63.43,10.40;Tromsø,69.65,18.96;Stavanger,58.97,5.73
DK|Europe/Copenhagen|Tanska|Denmark|København,55.68,12.57;Aarhus,56.16,10.20;Odense,55.40,10.39
EE|Europe/Tallinn|Viro|Estonia|Tallinn,59.44,24.75;Tartu,58.38,26.72
LV|Europe/Riga|Latvia|Latvia|Riga,56.95,24.11
LT|Europe/Vilnius|Liettua|Lithuania|Vilnius,54.69,25.28
IS|Atlantic/Reykjavik|Islanti|Iceland|Reykjavík,64.15,-21.94
DE|Europe/Berlin|Saksa|Germany|Berlin,52.52,13.41;München,48.14,11.58;Hamburg,53.55,9.99;Köln,50.94,6.96;Frankfurt,50.11,8.68
GB|Europe/London|Iso-Britannia|United Kingdom|London,51.51,-0.13;Manchester,53.48,-2.24;Edinburgh,55.95,-3.19;Birmingham,52.49,-1.89;Glasgow,55.86,-4.25
IE|Europe/Dublin|Irlanti|Ireland|Dublin,53.35,-6.26
FR|Europe/Paris|Ranska|France|Paris,48.86,2.35;Marseille,43.30,5.37;Lyon,45.76,4.84
ES|Europe/Madrid|Espanja|Spain|Madrid,40.42,-3.70;Barcelona,41.39,2.17;Sevilla,37.39,-5.98
IT|Europe/Rome|Italia|Italy|Roma,41.90,12.50;Milano,45.46,9.19;Napoli,40.85,14.27
NL|Europe/Amsterdam|Alankomaat|Netherlands|Amsterdam,52.37,4.90
BE|Europe/Brussels|Belgia|Belgium|Bruxelles,50.85,4.35
AT|Europe/Vienna|Itävalta|Austria|Wien,48.21,16.37
CH|Europe/Zurich|Sveitsi|Switzerland|Zürich,47.38,8.54;Genève,46.20,6.14
PL|Europe/Warsaw|Puola|Poland|Warszawa,52.23,21.01;Kraków,50.06,19.94
CZ|Europe/Prague|Tšekki|Czechia|Praha,50.08,14.44
HU|Europe/Budapest|Unkari|Hungary|Budapest,47.50,19.04
GR|Europe/Athens|Kreikka|Greece|Athína,37.98,23.73
PT|Europe/Lisbon|Portugali|Portugal|Lisboa,38.72,-9.14;Porto,41.15,-8.61
RU|Europe/Moscow|Venäjä|Russia|Moskva,55.76,37.62;Sankt-Peterburg,59.93,30.34;Viipuri (Vyborg),60.71,28.75;Sortavala,61.70,30.69;Käkisalmi (Priozersk),61.04,30.12;Koivisto (Primorsk),60.37,28.60;Petsamo (Pechenga),69.53,31.23;Murmansk,68.97,33.09;Kaliningrad,54.71,20.51,Europe/Kaliningrad;Samara,53.20,50.15,Europe/Samara;Jekaterinburg (Yekaterinburg),56.84,60.61,Asia/Yekaterinburg;Omsk,54.99,73.37,Asia/Omsk;Novosibirsk,55.03,82.92,Asia/Novosibirsk;Krasnojarsk (Krasnoyarsk),56.01,92.85,Asia/Krasnoyarsk;Irkutsk,52.29,104.30,Asia/Irkutsk;Vladivostok,43.12,131.89,Asia/Vladivostok
UA|Europe/Kyiv|Ukraina|Ukraine|Kyiv,50.45,30.52
TR|Europe/Istanbul|Turkki|Türkiye|İstanbul,41.01,28.98
US|America/New_York|Yhdysvallat|United States|New York,40.71,-74.01;Los Angeles,34.05,-118.24,America/Los_Angeles;Chicago,41.88,-87.63,America/Chicago;Houston,29.76,-95.37,America/Chicago;Miami,25.76,-80.19;Seattle,47.61,-122.33,America/Los_Angeles;Denver,39.74,-104.99,America/Denver;Boston,42.36,-71.06;San Francisco,37.77,-122.42,America/Los_Angeles;Atlanta,33.75,-84.39;Minneapolis,44.98,-93.27,America/Chicago;Anchorage,61.22,-149.90,America/Anchorage;Honolulu,21.31,-157.86,Pacific/Honolulu;Phoenix,33.45,-112.07,America/Phoenix;Detroit,42.33,-83.05,America/Detroit
CA|America/Toronto|Kanada|Canada|Toronto,43.65,-79.38;Montréal,45.50,-73.57;Vancouver,49.28,-123.12,America/Vancouver;Ottawa,45.42,-75.70;Calgary,51.05,-114.07,America/Edmonton;Edmonton,53.55,-113.49,America/Edmonton;Winnipeg,49.90,-97.14,America/Winnipeg;Regina,50.45,-104.62,America/Regina;Saskatoon,52.13,-106.67,America/Regina;Halifax,44.65,-63.57,America/Halifax;St. John's,47.56,-52.71,America/St_Johns
MX|America/Mexico_City|Meksiko|Mexico|Ciudad de México,19.43,-99.13;Guadalajara,20.66,-103.35;Monterrey,25.69,-100.32,America/Monterrey;Tijuana,32.51,-117.04,America/Tijuana;Cancún,21.16,-86.85,America/Cancun;Hermosillo,29.07,-110.96,America/Hermosillo;Chihuahua,28.63,-106.07,America/Chihuahua
BR|America/Sao_Paulo|Brasilia|Brazil|São Paulo,-23.55,-46.63;Rio de Janeiro,-22.91,-43.17;Brasília,-15.79,-47.88;Porto Alegre,-30.03,-51.23;Salvador,-12.97,-38.50,America/Bahia;Fortaleza,-3.73,-38.53,America/Fortaleza;Recife,-8.05,-34.88,America/Recife;Belém,-1.46,-48.50,America/Belem;Manaus,-3.12,-60.02,America/Manaus;Rio Branco,-9.97,-67.81,America/Rio_Branco
AR|America/Argentina/Buenos_Aires|Argentiina|Argentina|Buenos Aires,-34.60,-58.38
AU|Australia/Sydney|Australia|Australia|Sydney,-33.87,151.21;Melbourne,-37.81,144.96,Australia/Melbourne;Brisbane,-27.47,153.03,Australia/Brisbane;Perth,-31.95,115.86,Australia/Perth;Canberra,-35.28,149.13;Adelaide,-34.93,138.60,Australia/Adelaide;Darwin,-12.46,130.84,Australia/Darwin;Hobart,-42.88,147.33,Australia/Hobart
NZ|Pacific/Auckland|Uusi-Seelanti|New Zealand|Auckland,-36.85,174.76
JP|Asia/Tokyo|Japani|Japan|Tokyo,35.68,139.69
CN|Asia/Shanghai|Kiina|China|Beijing,39.90,116.41;Shanghai,31.23,121.47
IN|Asia/Kolkata|Intia|India|Delhi,28.61,77.21;Mumbai,19.08,72.88
TH|Asia/Bangkok|Thaimaa|Thailand|Bangkok,13.76,100.50
KR|Asia/Seoul|Etelä-Korea|South Korea|Seoul,37.57,126.98
SG|Asia/Singapore|Singapore|Singapore|Singapore,1.35,103.82
ZA|Africa/Johannesburg|Etelä-Afrikka|South Africa|Johannesburg,-26.20,28.05;Cape Town,-33.92,18.42
EG|Africa/Cairo|Egypti|Egypt|Kairo,30.04,31.24
IL|Asia/Jerusalem|Israel|Israel|Jerusalem,31.77,35.22;Tel Aviv,32.09,34.78
AE|Asia/Dubai|Arabiemiraatit|United Arab Emirates|Dubai,25.20,55.27`.split("\n").map(l=>{const[a,tz,fi,en,cs]=l.split("|");return{cc:a,fi,en,cs:cs.split(";").map(s=>{const p=s.split(",");return{n:p[0],lat:+p[1],lon:+p[2],tz:p[3]||tz}})}});

// Places that belonged to Finland at some time: the clock followed Finnish time within these date ranges (YYYYMMDD, inclusive).
const HISTFI = {
  "Viipuri (Vyborg)": [[0, 19400313], [19410831, 19440620]],
  "Käkisalmi (Priozersk)": [[0, 19400313], [19410831, 19440620]],
  "Koivisto (Primorsk)": [[0, 19400313], [19410831, 19440620]],
  "Sortavala": [[0, 19400313], [19410831, 19440919]],
  "Petsamo (Pechenga)": [[19201014, 19440919]]
};
function resolveTz(place, y, m, d){
  const w = HISTFI[place.n], ymd = y * 10000 + m * 100 + d;
  if(w && w.some(r => ymd >= r[0] && ymd <= r[1])) return {tz: "Europe/Helsinki", hist: true};
  return {tz: place.tz, hist: false};
}

const SIGN=["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"].map(s=>s+"\uFE0E");
// Bodies 0-10: Sun..Pluto, North Node. Extras: 11 Lilith, 12 South Node, 13 Part of Fortune, 14 Vertex.
const PG=["\u2609","\u263D","\u263F","\u2640","\u2642","\u2643","\u2644","\u2645","\u2646","\u2647","\u260A","\u26B8","\u260B","\u2297"].map(s=>s+"\uFE0E").concat(["Vx"]);
const NB=15, XT=[11,12,13,14];
// Aspects: [angle, orb, colour, symbol, minor]
const ASPT=[
[0,8,"#e0b866","\u260C\uFE0E",0],
[30,2,"#a995e0","\u26BA\uFE0E",1],
[45,2.5,"#c8467f","\u2220",1],
[60,5,"#6fb596","\u26B9\uFE0E",0],
[90,7,"#c8467f","\u25A1",0],
[120,7,"#6fb596","\u25B3",0],
[135,2.5,"#c8467f","\u26BC\uFE0E",1],
[150,3,"#a995e0","\u26BB\uFE0E",1],
[180,8,"#c8467f","\u260D\uFE0E",0]];
// Fixed stars: [name, RA J2000 (hours), Dec J2000 (deg), distance (light years)]
const STARS=[
["Algol",3.136148,40.95565,90],["Alcyone",3.791411,24.10514,440],["Aldebaran",4.598678,16.5093,65],
["Rigel",5.242298,-8.20164,860],["Capella",5.278155,45.998,43],["Betelgeuse",5.91953,7.40706,550],
["Sirius",6.752477,-16.71611,8.6],["Procyon",7.655033,5.22499,11.5],["Pollux",7.755264,28.02619,34],
["Regulus",10.139531,11.96721,79],["Spica",13.419883,-11.16132,250],["Arcturus",14.260742,19.18242,37],
["Antares",16.490128,-26.432,550],["Vega",18.61565,38.78369,25],["Altair",19.846389,8.86833,17],
["Deneb",20.690528,45.28028,2600],["Fomalhaut",22.960847,-29.62224,25]];
const L={fi:{
sub:"Astrologinen kartta syntymähetkesi taivaasta – tutustu planeettojen sijainteihin ja niiden symbolisiin tulkintoihin.",your:"Tietosi",date:"Syntymäpäivä",time:"Syntymän kellonaika",unk:"En tiedä tarkkaa kellonaikaa",country:"Syntymämaa",place:"Syntymäpaikka",
hint:"Syntymäpaikka määrittää, miltä taivas näytti juuri siellä syntymähetkelläsi. Kirjoita paikkakunnan nimi ja valitse se avautuvasta listasta.",man:"Syötä koordinaatit itse",tz:"Aikavyöhyke (IANA)",go:"Laske kartta",
empty:"Täytä tietosi vasemmalta ja valitse paikka listasta, niin kartta piirtyy tähän.",pick:"Valitse paikkakunta listalta.",baddate:"Syötä syntymäpäivä.",badco:"Tarkista koordinaatit ja aikavyöhyke.",
sign:["Oinas","Härkä","Kaksoset","Rapu","Leijona","Neitsyt","Vaaka","Skorpioni","Jousimies","Kauris","Vesimies","Kalat"],
kw:["rohkea ja välitön","vakaa ja aistillinen","utelias ja vaihteleva","suojaava ja tunteellinen","loistava ja antelias","tarkka ja käytännöllinen","tasapainoa ja kumppanuutta etsivä","syvä ja intensiivinen","vapautta ja merkitystä etsivä","kurinalainen ja kunnianhimoinen","omaperäinen ja riippumaton","herkkä ja mielikuvituksellinen"],
body:["Aurinko","Kuu","Merkurius","Venus","Mars","Jupiter","Saturnus","Uranus","Neptunus","Pluto","Pohjoinen solmu","Lilith (keskimääräinen)","Eteläinen solmu","Fortuna-piste","Vertex"],asc:"Nousumerkki",mc:"Keskitaivas (MC)",
mean:["Perusluonne ja elämänvoima","Tunteet ja turvan tarve","Ajattelu ja puhetapa","Rakkaus ja arvot","Tahto ja toimintatapa"],ascm:"Ulospäin näkyvä olemus",
th:["Kohde","Merkki","Aste","Talo"],house:"Talo",asp:"Aspektit",quick:"Pikatulkinnat",full:"Kaikki sijainnit",svg:"Tallenna SVG",png:"Tallenna PNG",
note:"Laskenta: astronomy-engine (tarkkuus alle 1 kaariminuutti), todellinen solmu, keskimääräinen Lilith.",fort:"Fortuna-piste vaihtaa laskukaavaa yösyntymillä.",
hsys:"Talojärjestelmä",hsW:"Whole Sign (kokonaiset merkit)",hsE:"Equal (tasatalot)",hHs:"Talojärjestelmä määrää, mistä kohdasta talot alkavat. Placidus on yleisin; Whole Sign tekee jokaisesta merkistä yhden talon.",
hsn:{P:"Placidus-talot",K:"Koch-talot",W:"Whole Sign -talot",E:"Equal-talot"},
aspm:"Aspektit",aspAll:"Pää- ja sivuaspektit",aspMaj:"Vain pääaspektit",ext:"Näytä lisäpisteet (Lilith, eteläinen solmu, Fortuna, Vertex)",hExt:"Fortuna ja Vertex vaativat tarkan kellonajan.",
aspT:"Aspektitaulukko",aspN:"Vihreä = sujuva, punainen = jännite, violetti = hienovarainen, kulta = konjunktio. Napauta tai vie hiiri ruudun päälle nähdäksesi selityksen.",
dist:"Alkuaineet ja ominaisuudet",distN:"Mukana Aurinko–Pluto sekä, jos kellonaika on tiedossa, nousumerkki ja MC.",dom:"Vallitseva alkuaine",domM:"Vallitseva ominaisuus",
stars:"Kiinteät tähdet",starsN:"Paikat on laskettu vuoden 2000 koordinaateista syntymähetkeen (prekessio huomioitu, tähtien oma liike ei). Konjunktio = alle 1° päässä planeetasta, pisteestä tai akselista.",sth:["Tähti","Merkki","Aste","Konjunktio"],untime:"Kellonaika ei ole tiedossa, joten nousumerkki ja talot jätetään pois.",rx:"Rx = taaksepäinen",
intro:"Mitä tarkemmat syntymätiedot ovat, sitä tarkempi kartasta tulee. Kartan voi laskea myös ilman kellonaikaa. Tiedot tallentuvat tähän selaimeen, ja Nollaa-painike poistaa ne.",
hDate:"Syntymäpäivä määrittää esimerkiksi aurinkomerkkisi eli tutun horoskooppimerkkisi sekä planeettojen sijainnit.",
hTime:"Kellonaika määrittää esimerkiksi nousumerkkisi ja talojen jaon. Jos et tiedä sitä, valitse ruutu: kartta piirretään silloin ilman nousumerkkiä ja taloja, ja Kuun sijainti on vain suuntaa antava.",
hMan:"Käytä tätä, jos paikkakuntaasi ei löydy listalta. Koordinaatit löydät esimerkiksi karttapalvelusta.",
chartHint:"Vie hiiri kartan osan päälle tai napauta sitä (planeetta, merkki, talo, akseli tai viiva), niin näet selityksen. Zoomaa +/−-painikkeilla, kaksoisnapautuksella tai nipistämällä; zoomattua karttaa voi vetää sormella.",
quickIntro:"Yleisluontoisia, symbolisia tulkintoja. Aurinkomerkki on tuttu horoskooppimerkkisi, Kuu kuvaa tunne-elämääsi ja nousumerkki sitä, miltä näytät ulospäin.",
close:"Sulje",zin:"Lähennä",zout:"Loitonna",zreset:"Näytä koko kartta",reset:"Nollaa",resetT:"Palauta oletusarvot ja poista tallennetut tiedot",
pd:["Perusluonteesi, identiteettisi ja elämänvoimasi: se, kuka olet ja mihin suuntaat. Aurinkomerkki on tuttu horoskooppimerkkisi.",
"Tunteesi, vaistosi ja turvan tarpeesi: se, mikä saa olosi kotoisaksi ja miten reagoit tunteellisesti.",
"Ajattelutapasi, puhetapasi ja tapasi oppia ja viestiä.",
"Rakkaus, kauneus ja arvot: mistä nautit ja millaisia suhteita haet.",
"Tahto, rohkeus ja toimintatapa: miten ajat asioita ja käytät energiaasi.",
"Kasvu, onni ja merkityksen etsintä: missä uskallat laajentaa ja luottaa.",
"Vastuu, rajat ja kypsyminen: missä tarvitset kärsivällisyyttä ja kurinalaisuutta.",
"Vapaus, uudistus ja yllätykset: missä rikot totuttua ja olet omaperäinen.",
"Unelmat, intuitio ja mielikuvitus: missä haaveilet, eläydyt tai asiat sumenevat.",
"Syvä muutos ja voima: missä vanha päättyy ja uutta syntyy.",
"Kuun kiertoradan nouseva solmu. Symbolisesti suunta, johon kasvat: vieras alue, joka vaatii opettelua.",
"Kuun kiertoradan kaukaisin piste (keskimääräinen apogee, ”Musta Kuu”). Symbolisesti piilotettu, villi tai torjuttu puoli: se, mitä et suostu mukauttamaan muiden odotuksiin.",
"Pohjoisen solmun vastakohta. Symbolisesti tuttu ja jo hallittu alue: taidot ja tottumukset, joihin on helppo turvautua, mutta joihin voi myös jäädä jumiin.",
"Nousumerkistä, Auringosta ja Kuusta laskettu piste. Symbolisesti se, missä onni ja hyvinvointi tuntuvat luontevimmilta.",
"Laskennallinen piste kartan länsipuolella, jossa ekliptika leikkaa itä–länsi-suuntaisen pystyympyrän (prime vertical). Symbolisesti kohtalokkaat kohtaamiset ja ihmiset, jotka tuntuvat tulevan elämääsi kuin itsestään."],
slow:"Hidas planeetta: se viipyy samassa merkissä vuosia, joten merkki on yhteinen koko ikäluokallesi. Henkilökohtaisemmin kertoo talo.",
moonN:"Kellonaika ei ole tiedossa, joten Kuun sijainti on vain suuntaa antava: Kuu liikkuu päivässä yli 12 astetta.",
ins:"Merkissä",typ:"Tyypillisesti:",retro:"taaksepäinen",
hn:n=>n+". talo",
hs:["Minä, ulkoinen olemus ja tapa aloittaa asioita.","Raha, omaisuus, omat voimavarat ja arvot.","Viestintä, lähipiiri, sisarukset ja oppiminen.","Koti, perhe, juuret ja yksityinen sisin.","Luovuus, rakkaus, leikki ja itseilmaisu.","Arki, työ, rutiinit ja hyvinvointi.","Parisuhteet, kumppanuudet ja läheiset vuorovaikutussuhteet.","Yhteiset resurssit, intiimi side ja syvät muutokset.","Matkat, opiskelu, uskomukset ja maailmankatsomus.","Ura, tavoitteet ja julkinen rooli.","Ystävät, yhteisöt, toiveet ja tulevaisuuden unelmat.","Piilotettu puoli, lepo, alitajunta ja irti päästäminen."],
starts:"Alkaa merkistä",here:"Kartassasi tässä merkissä:",hereH:"Kartassasi tässä talossa:",none:"ei yhtään planeettaa",
el:["Tuli","Maa","Ilma","Vesi"],
eld:["Tulimerkki: intoa, rohkeutta ja toimintaa.","Maamerkki: käytännöllisyyttä, pysyvyyttä ja aistillisuutta.","Ilmamerkki: ajattelua, puhetta ja vuorovaikutusta.","Vesimerkki: tunteita, herkkyyttä ja vaistoa."],
mo:["Aloittava","Vakaa","Muuttuva"],
mod:["Aloittava (kardinaali) merkki tarttuu uuteen ja käynnistää asioita.","Vakaa (kiinteä) merkki pitää kiinni ja vie asiat loppuun.","Muuttuva merkki mukautuu ja vaihtaa suuntaa joustavasti."],
an:["Konjunktio","Puolisekstiili","Puolineliö","Sekstiili","Neliö","Trigoni","Seskvineliö","Kvinkunssi","Oppositio"],
ad:["Kaksi pistettä samassa kohdassa: voimat sulautuvat ja vahvistavat toisiaan, hyvässä ja pahassa. Ei piirretä kartalle viivaksi.","Pieni ja hienovarainen yhteys: vierekkäisillä merkeillä ei ole mitään yhteistä, joten yhteys tuntuu hieman vieraalta. Violetti viiva.","Lievä kitka ja ärtymys: pieni jännite, joka kasaantuu helposti ja vaatii huomiota. Punainen viiva.","Sujuva ja tukeva yhteys: kaksi puolta sinussa tekee luontevasti yhteistyötä, kun siihen tarttuu. Vihreä viiva.","Jännite, joka haastaa toimimaan: kaksi puolta vetää eri suuntiin, ja ristiriita ajaa usein kehittymään. Punainen viiva.","Helppo ja luonteva yhteys: voimavara, joka toimii melkein itsestään. Vihreä viiva.","Levoton jännite: lievä mutta toistuva ärsyke, joka patistaa toimimaan. Punainen viiva.","Epämukava, vaikeasti sovitettava yhteys: kaksi puolta ei ymmärrä toisiaan luontevasti ja tilanne vaatii jatkuvaa säätämistä. Violetti viiva.","Vastakkainasettelu: kaksi puolta on vastapäätä toisiaan, ja haasteena on löytää niiden välille tasapaino. Punainen viiva."],
orbL:"Poikkeama tarkasta kulmasta",
axn:{A:"Nousumerkki (ASC)",D:"Laskeva merkki (DSC)",M:"Keskitaivas (MC)",I:"Pohjataivas (IC)"},
axd:{A:"Merkki, joka nousi itähorisontista syntymähetkelläsi. Kuvaa ulospäin näkyvää olemustasi ja ensivaikutelmaa. Kartan vasen reuna.",
D:"Nousumerkin vastakohta kartan oikeassa reunassa. Kuvaa sitä, mitä etsit toisista ihmisistä ja kumppanuuksista.",
M:"Kartan korkein kohta. Kuvaa uraa, tavoitteita ja julkista roolia.",
I:"Kartan alin kohta. Kuvaa kotia, juuria ja yksityistä sisintä."}},
en:{sub:"An astrological map of the sky at your birth, exploring planetary positions and their symbolic meanings.",your:"Your details",date:"Date of birth",time:"Time of birth",unk:"I don’t know the exact time",country:"Country of birth",place:"Place of birth",
hint:"The place of birth determines what the sky looked like from exactly there at the moment you were born. Type the first letters of the place and choose it from the list.",man:"Enter coordinates myself",tz:"Time zone (IANA)",go:"Cast the chart",
empty:"Fill in your details and choose a place from the list to draw the chart.",pick:"Choose the place from the list.",baddate:"Enter a date of birth.",badco:"Check the coordinates and time zone.",
sign:["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"],
kw:["bold and direct","steady and sensual","curious and changeable","protective and feeling","radiant and generous","precise and practical","seeking balance and partnership","deep and intense","seeking freedom and meaning","disciplined and ambitious","original and independent","sensitive and imaginative"],
body:["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","North Node","Lilith (mean apogee)","South Node","Part of Fortune","Vertex"],asc:"Ascendant",mc:"Midheaven (MC)",
mean:["Core self and vitality","Emotions and need for safety","Thinking and speech","Love and values","Will and drive"],ascm:"The face you show the world",
th:["Body","Sign","Degree","House"],house:"House",asp:"Aspects",quick:"Quick readings",full:"All positions",svg:"Save SVG",png:"Save PNG",
note:"Calculated with astronomy-engine (sub-arcminute accuracy), true node, mean Lilith.",fort:"The Part of Fortune switches its formula for night births.",
hsys:"House system",hsW:"Whole Sign",hsE:"Equal",hHs:"The house system decides where the houses begin. Placidus is the most common; Whole Sign makes each sign one house.",
hsn:{P:"Placidus houses",K:"Koch houses",W:"Whole Sign houses",E:"Equal houses"},
aspm:"Aspects",aspAll:"Major and minor aspects",aspMaj:"Major aspects only",ext:"Show extra points (Lilith, South Node, Fortune, Vertex)",hExt:"Fortune and Vertex need an exact birth time.",
aspT:"Aspect grid",aspN:"Green = flowing, red = tension, violet = subtle, gold = conjunction. Tap or hover a cell for an explanation.",
dist:"Elements and modalities",distN:"Includes Sun to Pluto and, if the birth time is known, the ascendant and MC.",dom:"Dominant element",domM:"Dominant modality",
stars:"Fixed stars",starsN:"Positions are computed from year-2000 coordinates to the moment of birth (precession included, stars’ own motion not). Conjunct = within 1° of a planet, point or axis.",sth:["Star","Sign","Degree","Conjunct"],untime:"Birth time is unknown, so ascendant and houses are left out.",rx:"Rx = retrograde",
intro:"The more precise your birth details are, the more precise the chart will be. A chart can also be made without the time of birth. Your details are saved in this browser, and the Reset button clears them.",
hDate:"The date of birth determines, for example, your Sun sign (the zodiac sign you already know) and the positions of the planets.",
hTime:"The time of birth determines, for example, your rising sign and the division of the houses. If you don’t know it, tick the box: the chart is then drawn without the ascendant and houses, and the Moon’s position is only approximate.",
hMan:"Use this if your place is not on the list. You can find coordinates in any map service.",
chartHint:"Hover over a part of the chart or tap it (planet, sign, house, axis or line) to see an explanation. Zoom with the +/− buttons, a double-tap or a pinch; drag a zoomed chart to move it.",
quickIntro:"General, symbolic readings. The Sun sign is the zodiac sign you know, the Moon describes your emotional life and the ascendant how you appear to others.",
close:"Close",zin:"Zoom in",zout:"Zoom out",zreset:"Show the whole chart",reset:"Reset",resetT:"Restore defaults and clear the saved details",
pd:["Your core self, identity and vitality: who you are and where you are heading. The Sun sign is the zodiac sign you know.",
"Your emotions, instincts and need for safety: what makes you feel at home and how you react emotionally.",
"How you think, speak, learn and communicate.",
"Love, beauty and values: what you enjoy and what kind of relationships you seek.",
"Will, courage and drive: how you pursue things and use your energy.",
"Growth, luck and the search for meaning: where you dare to expand and trust.",
"Responsibility, limits and maturing: where you need patience and discipline.",
"Freedom, reform and surprises: where you break the routine and are original.",
"Dreams, intuition and imagination: where you dream, empathize or things blur.",
"Deep change and power: where the old ends and something new is born.",
"The rising node of the Moon’s orbit. Symbolically the direction you grow toward: unfamiliar ground that takes practice.",
"The farthest point of the Moon’s orbit (mean apogee, the “Black Moon”). Symbolically a hidden, wild or rejected side: what you refuse to fit to other people’s expectations.",
"Opposite the North Node. Symbolically familiar, already mastered ground: skills and habits that are easy to fall back on, but that you can also get stuck in.",
"A point calculated from the ascendant, Sun and Moon. Symbolically where luck and well-being come most naturally.",
"A calculated point in the west of the chart where the ecliptic crosses the prime vertical (the east–west vertical circle). Symbolically fateful encounters and people who seem to arrive in your life as if on their own."],
slow:"A slow planet: it stays in one sign for years, so the sign is shared by your whole generation. The house says more about you personally.",
moonN:"The time of birth is unknown, so the Moon’s position is only approximate: the Moon moves over 12 degrees a day.",
ins:"In",typ:"Typically:",retro:"retrograde",
hn:n=>"House "+n,
hs:["The self, outward appearance and how you start things.","Money, possessions, your own resources and values.","Communication, your surroundings, siblings and learning.","Home, family, roots and your private inner life.","Creativity, romance, play and self-expression.","Daily life, work, routines and well-being.","Partnerships and close one-to-one relationships.","Shared resources, intimate bonds and deep change.","Travel, study, beliefs and worldview.","Career, goals and public role.","Friends, communities, hopes and dreams for the future.","The hidden side, rest, the subconscious and letting go."],
starts:"Begins in",here:"In your chart, in this sign:",hereH:"In your chart, in this house:",none:"no planets",
el:["Fire","Earth","Air","Water"],
eld:["Fire sign: enthusiasm, courage and action.","Earth sign: practicality, stability and sensuality.","Air sign: thinking, speech and interaction.","Water sign: feelings, sensitivity and instinct."],
mo:["Cardinal","Fixed","Mutable"],
mod:["A cardinal sign seizes the new and gets things started.","A fixed sign holds on and sees things through.","A mutable sign adapts and changes direction flexibly."],
an:["Conjunction","Semisextile","Semisquare","Sextile","Square","Trine","Sesquiquadrate","Quincunx","Opposition"],
ad:["Two points in the same place: the forces merge and amplify each other, for better or worse. Not drawn as a line on the chart.","A small, subtle link: neighbouring signs share nothing, so the connection feels slightly foreign. Violet line.","Mild friction and irritation: a small tension that builds up easily and needs attention. Red line.","A smooth, supportive link: two sides of you cooperate naturally when you act on it. Green line.","Tension that challenges you to act: two sides pull in different directions, and the conflict often drives growth. Red line.","An easy, natural link: a resource that works almost by itself. Green line.","A restless tension: a mild but recurring irritant that nudges you into action. Red line.","An awkward link that is hard to reconcile: two sides don’t understand each other naturally, and the situation needs constant adjusting. Violet line.","A face-off: two sides stand opposite each other, and the challenge is to find balance between them. Red line."],
orbL:"Distance from the exact angle",
axn:{A:"Ascendant (ASC)",D:"Descendant (DSC)",M:"Midheaven (MC)",I:"Imum Coeli (IC)"},
axd:{A:"The sign that was rising on the eastern horizon at your birth. Describes how you appear and your first impression. The left edge of the chart.",
D:"Opposite the ascendant, on the right edge of the chart. Describes what you look for in other people and partnerships.",
M:"The highest point of the chart. Describes career, goals and public role.",
I:"The lowest point of the chart. Describes home, roots and your private inner life."}}};

Object.assign(L.fi, INTERP.fi); Object.assign(L.en, INTERP.en);   // js/interp.js: extra interpretations and notices

// Language preference is stored under the existing, explicitly requested key.
// Everything lives under the one existing key "birthchart_store" as JSON: {lang, d, tm, unk, cc, place, man, la, lo, tz}.
// Older versions stored just "fi" or "en" there; that is still read.
const STORE_KEY="birthchart_store";
let store={};
try{const s=localStorage.getItem(STORE_KEY);if(s==="en"||s==="fi")store={lang:s};else if(s){const o=JSON.parse(s);if(o&&typeof o==="object"&&!Array.isArray(o))store=o}}catch(e){store={}}
function saveStore(){try{localStorage.setItem(STORE_KEY,JSON.stringify(store))}catch(e){}}
let lang=store.lang==="fi"?"fi":"en";
const $=id=>document.getElementById(id),t=k=>L[lang][k];

const R=Math.PI/180,nm=x=>((x%360)+360)%360;
let userSubmitted=false;
const fmtN=(x,n)=>lang==="fi"?x.toFixed(n).replace(".",","):x.toFixed(n);
const offStr=m=>"UTC"+(m<0?"\u2212":"+")+Math.floor(Math.abs(m)/60)+(Math.abs(m)%60?":"+String(Math.abs(m)%60).padStart(2,"0"):"");

function tzOff(ms, tz){
  const p = {};
  new Intl.DateTimeFormat("en-US", {timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric"}).formatToParts(new Date(ms)).forEach(x => p[x.type] = +x.value);
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000) / 6e4;
}
function toUTC(y, m, d, H, M, tz){
  const loc = Date.UTC(y, m - 1, d, H, M);
  let u = loc - tzOff(loc, tz) * 6e4;
  u = loc - tzOff(u, tz) * 6e4;
  return u;
}


let cur = {n:"Helsinki", lat:60.17, lon:24.94, tz:"Europe/Helsinki"}, sel = -1;
const cs = $("c"), pi = $("p"), sg = $("sug");
function fillCountries(){
  const v = cs.value || "FI";
  cs.innerHTML = [...DB].sort((a,b)=>a[lang].localeCompare(b[lang],lang)).map(c=>`<option value="${c.cc}">${c[lang]}</option>`).join("");
  cs.value = v;
}
function sugs(){
  const q = pi.value.trim().toLocaleLowerCase(), co = DB.find(c => c.cc === cs.value);
  if(!q){ sg.hidden = true; return; }
  const m = co.cs.filter(c => c.n.toLocaleLowerCase().startsWith(q)).slice(0, 8);
  sel = -1;
  sg.innerHTML = m.map((c, i) => `<li role="option" data-i="${co.cs.indexOf(c)}">${c.n}</li>`).join("");
  sg.hidden = !m.length;
  sg._m = m;
}
function pick(c){ cur = c; pi.value = c.n; sg.hidden = true; $("er").textContent = ""; }
pi.addEventListener("input", () => { cur = null; sugs(); });
pi.addEventListener("keydown", e => {
  const li = [...sg.children];
  if(sg.hidden || !li.length) return;
  if(e.key === "ArrowDown" || e.key === "ArrowUp"){
    e.preventDefault();
    sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + li.length) % li.length;
    li.forEach((x, i) => x.classList.toggle("on", i == sel));
  } else if(e.key === "Enter" && sel >= 0){
    e.preventDefault(); pick(sg._m[sel]);
  } else if(e.key === "Escape") sg.hidden = true;
});
sg.addEventListener("mousedown", e => {
  const li = e.target.closest("li");
  if(li) pick(DB.find(c => c.cc === cs.value).cs[+li.dataset.i]);
});
pi.addEventListener("blur", () => setTimeout(() => sg.hidden = true, 120));
cs.addEventListener("change", () => { cur = null; pi.value = ""; sg.hidden = true; const co = DB.find(c => c.cc === cs.value); $("tz").value = co.cs[0].tz; });
$("unk").addEventListener("change", e => $("tm").disabled = e.target.checked);
// House system, aspect set and extra points update an existing chart immediately.
["hs", "asp", "ext"].forEach(id => $(id).addEventListener("change", () => { if(!window.RES) return; const r = calc(); if(r){ window.RES = r; render(); } }));
$("man").addEventListener("change", e => { const on = e.target.checked; $("mb").style.display = on ? "grid" : "none"; pi.disabled = cs.disabled = on; });

let svgEl = null;
function el(n, a, txt){
  const e = document.createElementNS("http://www.w3.org/2000/svg", n);
  for(const k in a) e.setAttribute(k, a[k]);
  if(txt != null) e.textContent = txt;
  return e;
}
const deg = x => { let tm = Math.floor((x % 30) * 60 + .5); if(tm >= 1800) tm = 1799; return Math.floor(tm / 60) + "°" + String(tm % 60).padStart(2, "0") + "′"; };

function draw(res){
  const c = 400, g = el("svg", {
    viewBox: "-30 -30 860 860",
    role: "group",
    "aria-label": t("quick")
  });

  const rot = res.known ? res.h.asc : 0;
  // Zodiac grows counterclockwise, ASC on the left.
  const P = (lon, r) => {
    const a = (180 + (lon - rot)) * R;
    return [c + r * Math.cos(a), c - r * Math.sin(a)];
  };

  const line = (a, r1, b, r2, at) => {
    const p = P(a, r1), q = P(b, r2);
    return el("line", {
      x1: p[0], y1: p[1], x2: q[0], y2: q[1], ...at
    });
  };

  const arc = (a1, a2, r1, r2, fill) => {
    const p1 = P(a1, r2), p2 = P(a2, r2);
    const p3 = P(a2, r1), p4 = P(a1, r1);
    return el("path", {
      d: `M${p1}A${r2},${r2} 0 0 0 ${p2}L${p3}A${r1},${r1} 0 0 1 ${p4}Z`,
      fill, stroke: "#4a3470", "stroke-width": 1
    });
  };

  const RO = 385, RS = 335, RH = 222, RI = 190;
  const elFill = ["#c8467f2e", "#6fb5962e", "#a995e02e", "#4fa3b82e"];
  const elInk = ["#e58bb2", "#8fd0b3", "#c3b5f0", "#7cc0d2"];

  g.appendChild(el("circle", {
    cx: c, cy: c, r: RO + 14, fill: "none",
    stroke: "#3d2a5e", "stroke-width": 1
  }));

  // Zodiac sectors and sign labels.
  for(let i = 0; i < 12; i++){
    const sec = arc(i * 30, i * 30 + 30, RS, RO, elFill[i % 4]);
    sec.setAttribute("data-tip", "s|" + i);
    g.appendChild(sec);
    const p = P(i * 30 + 15, 360);
    g.appendChild(el("text", {
      x: p[0], y: p[1],
      "text-anchor": "middle",
      "dominant-baseline": "central",
      "font-size": 26,
      fill: elInk[i % 4],
      class: "sym"
    }, SIGN[i]));
  }

  // Degree scale: one tick per degree, with stronger 5° and 10° ticks.
  for(let d = 0; d < 360; d++){
    const major10 = d % 10 === 0;
    const major5 = d % 5 === 0;
    const inner = major10 ? RO - 15 : major5 ? RO - 10 : RO - 5;
    g.appendChild(line(d, inner, d, RO - 1, {
      stroke: major10 ? "#c8b6e5" : major5 ? "#806b9f" : "#49365f",
      "stroke-width": major10 ? 1.4 : major5 ? 1 : 0.6,
      opacity: major10 ? 0.9 : major5 ? 0.75 : 0.55
    }));
  }

  g.appendChild(el("circle", {
    cx: c, cy: c, r: RI, fill: "#0a0612",
    stroke: "#6a4f9a", "stroke-width": 1.2
  }));

  if(res.known){
    const cu = res.h.c;

    // Invisible house sectors that carry the explanations.
    for(let i = 0; i < 12; i++){
      let a = cu[i], b = cu[(i + 1) % 12];
      if(b < a) b += 360;
      const hs = arc(a, b, RI, RS, "transparent");
      hs.setAttribute("stroke", "none");
      hs.setAttribute("class", "hit");
      hs.setAttribute("data-tip", "h|" + (i + 1));
      g.appendChild(hs);
    }

    g.appendChild(el("circle", {
      cx: c, cy: c, r: RH, fill: "none",
      stroke: "#6a4f9a", "stroke-width": 1.2
    }));
    g.appendChild(el("circle", {
      cx: c, cy: c, r: RH - 4, fill: "none",
      stroke: "#4a3470", "stroke-width": 0.8
    }));

    // Cusps that coincide with an axis are drawn as the thicker axis line; all others here.
    const axs = [res.h.asc, res.h.asc + 180, res.h.mc, res.h.mc + 180];
    for(let i = 0; i < 12; i++){
      const onAxis = axs.some(x => Math.abs(((cu[i] - x + 540) % 360) - 180) < 0.05);
      if(!onAxis){
        g.appendChild(line(cu[i], RI, cu[i], RS, {
          stroke: "#4a3470", "stroke-width": 1.2
        }));
      }
      let a = cu[i], b = cu[(i + 1) % 12];
      if(b < a) b += 360;
      const p = P((a + b) / 2, (RI + RH) / 2 + 1);
      g.appendChild(el("text", {
        x: p[0], y: p[1],
        "text-anchor": "middle",
        "dominant-baseline": "central",
        "font-size": 14,
        fill: "#9a8bb0"
      }, i + 1));
    }

    const ax = (l, lab, key) => {
      g.appendChild(line(l, RI, l, RO, {
        stroke: "#e0b866", "stroke-width": 2.4
      }));
      g.appendChild(line(l, RI, l, RO, {
        stroke: "transparent", "stroke-width": 16, class: "hit", "data-tip": "x|" + key
      }));
      const p = P(l, RO + 2);
      g.appendChild(el("circle", {
        cx: p[0], cy: p[1], r: 17,
        fill: "#1d1233", stroke: "#e0b866",
        "data-tip": "x|" + key, tabindex: 0, role: "button", "aria-label": L[lang].axn[key]
      }));
      g.appendChild(el("text", {
        x: p[0], y: p[1],
        "text-anchor": "middle",
        "dominant-baseline": "central",
        "font-size": 12,
        fill: "#e0b866"
      }, lab));
    };

    ax(res.h.asc, "ASC", "A");
    ax(res.h.asc + 180, "DSC", "D");
    ax(res.h.mc, "MC", "M");
    ax(res.h.mc + 180, "IC", "I");
  } else {
    for(let i = 0; i < 12; i++){
      g.appendChild(line(i * 30, RI, i * 30, RS, {
        stroke: "#3a2858"
      }));
    }
  }

  // Aspect lines (conjunctions are not drawn). Minor aspects are thinner and dashed.
  const pts = res.lon.slice(0, 10).map((l, i) => ({l, i}));
  if(res.known){
    pts.push({l: res.h.asc, i: "A"}, {l: res.h.mc, i: "M"});
  }

  for(let i = 0; i < pts.length; i++){
    for(let j = i + 1; j < pts.length; j++){
      const f = aspectRes(res, pts[i].i, pts[j].i, res.asp === "major");
      if(!f || f.ai === 0) continue;
      const [angle, orb, color, , minor] = ASPT[f.ai];
      const at = {stroke: color, "stroke-width": minor ? 0.9 : 1.3, opacity: minor ? 0.65 : 0.85, class: "asp"};
      if(minor) at["stroke-dasharray"] = "4 3";
      g.appendChild(line(pts[i].l, RI - 1, pts[j].l, RI - 1, at));
      g.appendChild(line(
        pts[i].l, RI - 1, pts[j].l, RI - 1,
        {stroke: "transparent", "stroke-width": 12, class: "hit",
         "data-tip": "a|" + pts[i].i + "|" + pts[j].i + "|" + f.ai + "|" + f.off.toFixed(1) + "|" + f.ap}
      ));
    }
  }

  // Spread nearby planet labels without changing their actual zodiac positions.
  const bodies = res.lon.map((l, i) => ({l, i, labelAngle: l}))
    .filter(b => b.l != null)
    .sort((a, b) => a.l - b.l);

  for(let pass = 0; pass < 40; pass++){
    for(let i = 0; i < bodies.length; i++){
      const a = bodies[i], b = bodies[(i + 1) % bodies.length];
      let gap = b.labelAngle - a.labelAngle;
      if(i === bodies.length - 1) gap += 360;

      if(gap < 8){
        const move = (8 - gap) / 2;
        a.labelAngle -= move;
        b.labelAngle += move;
      }
    }
  }

  bodies.forEach(body => {
    const i = body.i;
    const sign = readSign(body.l);
    const color = elInk[sign % 4];

    const actual = P(body.l, RS);
    const tick = P(body.l, RS - 9);
    const label = P(body.labelAngle, 308);

    g.appendChild(el("line", {
      x1: actual[0], y1: actual[1],
      x2: tick[0], y2: tick[1],
      stroke: "#e0b866", "stroke-width": 1
    }));

    if(Math.abs(body.labelAngle - body.l) > 0.3){
      const elbow = P(body.labelAngle, 322);
      g.appendChild(el("line", {
        x1: tick[0], y1: tick[1],
        x2: elbow[0], y2: elbow[1],
        stroke: "#6a4f9a", "stroke-width": 0.8
      }));
    }

    g.appendChild(el("text", {
      x: label[0], y: label[1],
      "text-anchor": "middle",
      "dominant-baseline": "central",
      "font-size": i === 14 ? 15 : i >= 10 ? 22 : 25,
      fill: i < 2 ? "#e0b866" : "#e6dcef",
      class: "sym"
    }, PG[i]));

    const within = body.l % 30;
    const degrees = Math.floor(within);
    const minutes = Math.min(59, Math.floor((within - degrees) * 60 + 0.5));

    const p1 = P(body.labelAngle, 276);
    const p2 = P(body.labelAngle, 259);
    const p3 = P(body.labelAngle, 243);

    g.appendChild(el("text", {
      x: p1[0], y: p1[1],
      "text-anchor": "middle",
      "dominant-baseline": "central",
      "font-size": 12,
      fill: "#e6dcef"
    }, degrees + "°"));

    g.appendChild(el("text", {
      x: p2[0], y: p2[1],
      "text-anchor": "middle",
      "dominant-baseline": "central",
      "font-size": 13,
      fill: color,
      class: "sym"
    }, SIGN[sign]));

    g.appendChild(el("text", {
      x: p3[0], y: p3[1],
      "text-anchor": "middle",
      "dominant-baseline": "central",
      "font-size": 11,
      fill: "#9a8bb0"
    }, String(minutes).padStart(2, "0") + "′" + (res.rx[i] ? " ℞" : "")));

    // Wide invisible target so the whole planet label is easy to hit with a finger.
    const h1 = P(body.labelAngle, 238), h2 = P(body.labelAngle, 322);
    g.appendChild(el("line", {
      x1: h1[0], y1: h1[1], x2: h2[0], y2: h2[1],
      stroke: "transparent", "stroke-width": 30, "stroke-linecap": "round", class: "hit",
      "data-tip": "p|" + i, tabindex: 0, role: "button", "aria-label": L[lang].body[i]
    }));
  });

  return g;
}

function readSign(l){ return Math.floor(l / 30); }
// Finds the aspect between two longitudes: {ai: index into ASPT, off: distance from exact angle} or null.
// Orb factor per body id (0-14): luminaries get wider orbs, slow outer planets and calculated points narrower ones.
const BF = [1.25, 1.25, 1, 1, 1, .85, .85, .7, .7, .7, .6, .5, .6, .5, .5];
const bfOf = id => (id === "A" || id === "M") ? 1 : BF[id];
// Finds the aspect between two longitudes: {ai: index into ASPT, off: distance from exact angle} or null. fa, fb scale the orb.
function aspectOf(a, b, majorOnly, fa = 1, fb = 1){
  let d = Math.abs(a - b) % 360;
  if(d > 180) d = 360 - d;
  const k = (fa + fb) / 2;
  for(let ai = 0; ai < ASPT.length; ai++){
    if(majorOnly && ASPT[ai][4]) continue;
    const off = Math.abs(d - ASPT[ai][0]);
    if(off <= ASPT[ai][1] * k) return {ai, off};
  }
  return null;
}
const spOf = (res, id) => (id === "A" || id === "M") ? null : res.sp[id];
// Aspect between two chart points (ids as in chartPoints). ap: 1 applying, 0 separating, null unknown (axes, Fortune, Vertex).
function aspectRes(res, ia, ib, majorOnly){
  const a = lonOf(res, ia), b = lonOf(res, ib), f = aspectOf(a, b, majorOnly, bfOf(ia), bfOf(ib));
  if(!f) return null;
  f.ap = null;
  const sa = spOf(res, ia), sb = spOf(res, ib);
  if(sa != null && sb != null){
    let dd = nm(b - a); if(dd > 180) dd -= 360;
    const e = Math.abs(dd) - ASPT[f.ai][0], de = Math.sign(dd) * (sb - sa);
    if(Math.abs(e) > 0.005 && de !== 0) f.ap = e * de < 0 ? 1 : 0;
  }
  return f;
}
function houseOf(l, cu){
  for(let i = 0; i < 12; i++){
    let a = cu[i], b = cu[(i + 1) % 12], x = nm(l - a), w = nm(b - a);
    if(x < w) return i + 1;
  }
  return 1;
}

function calc(){
  const er = $("er"); er.textContent = "";
  const dv = $("d").value; if(!dv){ er.textContent = t("baddate"); return null; }
  let place;
  if($("man").checked){
    const la = parseFloat($("la").value.replace(",", ".")), lo = parseFloat($("lo").value.replace(",", ".")), tz = $("tz").value.trim();
    try{ new Intl.DateTimeFormat("en", {timeZone: tz}); } catch(e){ er.textContent = t("badco"); return null; }
    if(!(Math.abs(la) <= 90 && Math.abs(lo) <= 180)){ er.textContent = t("badco"); return null; }
    place = {lat: la, lon: lo, tz, n: la + ", " + lo};
  } else {
    if(!cur){ er.textContent = t("pick"); return null; }
    place = cur;
  }
  const [y, m, d] = dv.split("-").map(Number), known = !$("unk").checked, [H, M] = known ? ($("tm").value || "12:00").split(":").map(Number) : [12, 0];
  const tzr = resolveTz(place, y, m, d);
  const u = new Date(toUTC(y, m, d, H, M, tzr.tz));
  const offMin = tzOff(u.getTime(), tzr.tz);
  const jdUT = ast.julday(u.getUTCFullYear(), u.getUTCMonth() + 1, u.getUTCDate(), u.getUTCHours() + u.getUTCMinutes() / 60);

  const lon = [];
  const rx = [], sp = [];
  for(let i = 0; i < 11; i++){
    const resCalc = ast.calc_ut(jdUT, i, ast.SEFLG_SPEED);
    lon.push(nm(resCalc[0]));
    rx.push(i < 10 && resCalc[3] < 0);
    sp.push(resCalc[3]);
  }

  // Extra points: 11 Lilith, 12 South Node, 13 Part of Fortune, 14 Vertex (the last two need the birth time).
  const sys = $("hs").value, ext = $("ext").checked;
  lon[11] = ext ? nm(ast.meanApogee(jdUT)) : null;
  lon[12] = ext ? nm(lon[10] + 180) : null;
  lon[13] = lon[14] = null;
  for(let i = 11; i < NB; i++) rx.push(false);
  sp[11] = 0.1114; sp[12] = sp[10]; sp[13] = sp[14] = null;   // mean apogee moves ~0.111 deg/day; Fortune and Vertex have no useful speed

  let housesRes = null;
  if(known){
    const h = ast.houses(jdUT, place.lat, place.lon, sys);
    housesRes = {
      asc: nm(h.ascmc[0]),
      mc: nm(h.ascmc[1]),
      c: Array.from(h.cusps).slice(1, 13).map(val => nm(val)),
      polar: h.polar
    };
    if(ext){
      // Day birth (Sun above the horizon): Asc + Moon - Sun. Night birth: Asc + Sun - Moon.
      const day = nm(lon[0] - housesRes.asc) >= 180;
      lon[13] = nm(day ? housesRes.asc + lon[1] - lon[0] : housesRes.asc + lon[0] - lon[1]);
      lon[14] = nm(h.ascmc[3]);
    }
  }

  const sens = known ? ascSensitivity(jdUT, place.lat, place.lon) : null;
  const warn = [];
  if(housesRes && housesRes.polar) warn.push("polar");
  if(tzr.hist) warn.push("hist");
  if(y < 1970) warn.push("old");

  const stars = STARS.map(([n, ra, dec, ly], i) => ({n, i, l: nm(ast.star(jdUT, ra, dec, ly))})).sort((a, b) => a.l - b.l);

  return {lon, rx, sp, known, h: housesRes, place, sys, ext, asp: $("asp").value, stars, tz: tzr.tz, offMin, sens, warn, example: !userSubmitted && !store.d};
}

/* ---------- Extra sections: aspect grid, element/modality distribution, fixed stars ---------- */
function chartPoints(res){
  // ids of points that take part in aspects: Sun..Pluto, nodes, Lilith, Fortune, Vertex, then AC and MC. The South Node is left out (it only mirrors the North Node).
  const ids = [];
  for(let i = 0; i < NB; i++){ if(i !== 12 && res.lon[i] != null) ids.push(i); }
  if(res.known) ids.push("A", "M");
  return ids;
}
const lonOf = (res, id) => id === "A" ? res.h.asc : id === "M" ? res.h.mc : res.lon[id];
const ptLabel = id => id === "A" ? "AC" : id === "M" ? "MC" : PG[id];


/* ---------- Precision, interpretation helpers and chart patterns ---------- */
// How fast the ascendant moves at this moment and place: degrees per 4 min, and minutes until the rising sign changes.
function ascSensitivity(jd, lat, lon){
  const A = dt => nm(ast.houses(jd + dt / 1440, lat, lon, "E").ascmc[0]);
  const a0 = A(0), s0 = Math.floor(a0 / 30);
  const shift = Math.abs(((A(4) - A(-4) + 540) % 360) - 180) / 2;
  let up = null, dn = null;
  for(let m = 1; m <= 360 && (up === null || dn === null); m++){
    if(up === null && Math.floor(A(m) / 30) !== s0) up = m;
    if(dn === null && Math.floor(A(-m) / 30) !== s0) dn = m;
  }
  return {asc: a0, shift, lim: Math.min(up === null ? 1e9 : up, dn === null ? 1e9 : dn)};
}
const psText = (i, s) => { const T = L[lang]; return (i < 10 && T.ps && T.ps[i][s]) || (T.kw[s] + "."); };
const housePlanet = (i, h) => { const T = L[lang]; return i < 10 ? `${T.pf[i]}: ${T.emph} ${T.hth[h - 1]}.` : T.hs[h - 1]; };
const pfOf = (T, v) => v === "A" ? T.pfA : v === "M" ? T.pfM : T.pf[+v];
function pairText(a, b){
  const T = L[lang], isP = v => /^\d+$/.test(String(v)) && +v < 10;
  if(isP(a) && isP(b)){ const t2 = T.pair[Math.min(+a, +b) + "-" + Math.max(+a, +b)]; if(t2) return t2; }
  return `${T.thm}: ${pfOf(T, a)} · ${pfOf(T, b)}.`;
}

function findPatterns(res){
  const T = L[lang], out = [], P = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const nmP = i => `<span class="sym">${PG[i]}</span> ${T.body[i]}`;
  const grp = fn => { const g = {}; P.forEach(i => (g[fn(i)] = g[fn(i)] || []).push(i)); return g; };
  const bs = grp(i => readSign(res.lon[i]));
  const personal = g => g.filter(i => i < 5).length >= 2;   // a generational group (e.g. Saturn+Uranus+Neptune) is not a personal stellium
  Object.keys(bs).forEach(k => { if(bs[k].length >= 3 && personal(bs[k])) out.push(T.pst(`${T.sign[k]} <span class="sym">${SIGN[k]}</span>`, bs[k].map(nmP).join(", "))); });
  if(res.known){
    const bh = grp(i => houseOf(res.lon[i], res.h.c));
    Object.keys(bh).forEach(k => { if(bh[k].length >= 4 && personal(bh[k])) out.push(T.psth(T.hn(+k), bh[k].map(nmP).join(", "))); });
  }
  // aspect test with the pattern orb: base orb, narrowed for slow bodies
  const is = (a, b, ai) => {
    let d = Math.abs(res.lon[a] - res.lon[b]) % 360; if(d > 180) d = 360 - d;
    return Math.abs(d - ASPT[ai][0]) <= Math.min(6, ASPT[ai][1] * Math.min(1, (BF[a] + BF[b]) / 2));
  };
  for(const a of P) for(const b of P){
    if(b <= a) continue;
    if(is(a, b, 8)) for(const c of P) if(c !== a && c !== b && is(a, c, 4) && is(b, c, 4)) out.push(T.ptsq(nmP(a), nmP(b), nmP(c)));
    if(is(a, b, 3)) for(const c of P) if(c !== a && c !== b && is(a, c, 7) && is(b, c, 7)) out.push(T.pyod(nmP(a), nmP(b), nmP(c)));
    if(is(a, b, 5)) for(const c of P) if(c > b && is(a, c, 5) && is(b, c, 5)){
      const el = [a, b, c].map(i => readSign(res.lon[i]) % 4), same = el[0] === el[1] && el[1] === el[2];
      out.push(T.pgt([a, b, c].map(nmP).join(", "), same ? T.el[el[0]].toLowerCase() : ""));
    }
  }
  return out;
}
function patternSection(res, T){
  const box = document.createElement("div"); box.className = "sec";
  const pats = findPatterns(res);
  box.innerHTML = `<h2>${T.pat}</h2><p class="note">${T.patN}</p>` + (pats.length ? `<ul class="pat">${pats.map(x => `<li>${x}</li>`).join("")}</ul>` : `<p class="note">${T.patNone}</p>`);
  return box;
}
function astroView(res, T){
  const d = document.createElement("details"); d.className = "guide";
  const rows = [];
  if(res.known){ rows.push(["AC", res.h.asc, null]); rows.push(["MC", res.h.mc, null]); }
  res.lon.forEach((l, i) => { if(l != null) rows.push([`<span class="sym">${PG[i]}</span> ${T.body[i]}`, l, res.sp[i]]); });
  d.innerHTML = `<summary>${T.aT}</summary><p class="note">${T.aN}</p><div class="tw"><table><thead><tr>${T.aTh.map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody>`
    + rows.map(r => `<tr><td>${r[0]}</td><td>${fmtN(r[1], 3)}</td><td>${r[2] == null ? "–" : fmtN(r[2], 3)}</td><td>${r[2] == null ? "–" : T.aDir[r[2] < 0 ? 1 : 0]}</td></tr>`).join("")
    + "</tbody></table></div>";
  return d;
}

function aspectGrid(res, T){
  const ids = chartPoints(res), major = res.asp === "major", box = document.createElement("div");
  box.className = "sec";
  let h = `<h2>${T.aspT}</h2><p class="note">${T.aspN}</p><div class="tw"><table class="at"><thead><tr><th></th>`;
  ids.slice(0, -1).forEach(id => { h += `<th class="sym">${ptLabel(id)}</th>`; });
  h += "</tr></thead><tbody>";
  for(let i = 1; i < ids.length; i++){
    h += `<tr><th class="sym">${ptLabel(ids[i])}</th>`;
    for(let j = 0; j < i; j++){
      const f = aspectRes(res, ids[i], ids[j], major);
      if(f){
        h += `<td class="sym" style="color:${ASPT[f.ai][2]}" data-tip="a|${ids[j]}|${ids[i]}|${f.ai}|${f.off.toFixed(1)}|${f.ap}" tabindex="0" role="button" aria-label="${T.an[f.ai]}">${ASPT[f.ai][3]}</td>`;
      } else h += "<td></td>";
    }
    h += "</tr>";
  }
  box.innerHTML = h + "</tbody></table></div>";
  return box;
}

function distribution(res, T){
  const ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; if(res.known) ids.push("A", "M");
  const cells = [0, 1, 2, 3].map(() => [[], [], []]);
  ids.forEach(id => { const s = readSign(lonOf(res, id)); cells[s % 4][s % 3].push(ptLabel(id)); });
  const rowT = cells.map(r => r.reduce((a, c) => a + c.length, 0));
  const colT = [0, 1, 2].map(m => cells.reduce((a, r) => a + r[m].length, 0));
  const top = (arr, names) => { const mx = Math.max(...arr); return names.filter((_, i) => arr[i] === mx).join(" / ") + " (" + mx + ")"; };
  const box = document.createElement("div"); box.className = "sec";
  let h = `<h2>${T.dist}</h2><p class="note">${T.distN}</p><div class="tw"><table class="dist"><thead><tr><th></th>${T.mo.map(m => `<th>${m}</th>`).join("")}<th class="tot">Σ</th></tr></thead><tbody>`;
  cells.forEach((r, e) => {
    h += `<tr><td>${T.el[e]}</td>${r.map(c => `<td class="g sym">${c.join(" ")}</td>`).join("")}<td class="tot">${rowT[e]}</td></tr>`;
  });
  h += `<tr><td class="tot">Σ</td>${colT.map(c => `<td class="tot">${c}</td>`).join("")}<td class="tot">${ids.length}</td></tr></tbody></table></div>`;
  h += `<p class="note">${T.dom}: ${top(rowT, T.el)} · ${T.domM}: ${top(colT, T.mo)}</p>`;
  box.innerHTML = h;
  return box;
}

function starTable(res, T){
  const ids = []; for(let i = 0; i < NB; i++){ if(res.lon[i] != null) ids.push(i); } if(res.known) ids.push("A", "M");
  const name = id => id === "A" ? T.asc : id === "M" ? T.mc : `<span class="sym">${PG[id]}</span> ${T.body[id]}`;
  const dd = x => { const tm = Math.round(x * 60); return Math.floor(tm / 60) + "°" + String(tm % 60).padStart(2, "0") + "′"; };
  const box = document.createElement("div"); box.className = "tw sec";
  let h = `<h2>${T.stars}</h2><p class="note">${T.starsN}</p><table class="stars"><thead><tr>${T.sth.map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody>`;
  res.stars.forEach(st => {
    let best = null;
    ids.forEach(id => { let d = Math.abs(lonOf(res, id) - st.l) % 360; if(d > 180) d = 360 - d; if(!best || d < best.d) best = {id, d}; });
    const hit = best.d < 1, s = readSign(st.l);
    h += `<tr${hit ? ' class="hit"' : ""}><td>${st.n}</td><td><span class="sym">${SIGN[s]}</span> ${T.sign[s]}</td><td>${deg(st.l)}</td><td>${name(best.id)} (${dd(best.d)})${hit ? " – " + T.conjw : ""}</td><td>${T.starM[st.i]}</td></tr>`;
  });
  box.innerHTML = h + "</tbody></table>";
  return box;
}

function render(){
  if(!window.RES) return;
  const res = window.RES, T = L[lang], box = $("res");
  box.innerHTML = ""; hideTip();
  const h2 = document.createElement("h2");
  h2.textContent = res.place.n + " · " + $("d").value.split("-").reverse().join(".") + (res.known ? " " + $("tm").value : "");
  box.appendChild(h2);

  if(res.example){ const bn = document.createElement("div"); bn.className = "banner"; bn.textContent = T.exBanner; box.appendChild(bn); }
  if(res.warn.length){
    const w = document.createElement("div"); w.className = "warn"; w.setAttribute("role", "note");
    w.innerHTML = res.warn.map(k => "<p>" + (k === "polar" ? T.wPolar(fmtN(Math.abs(res.place.lat), 1)) : k === "hist" ? T.wHist(res.tz) : T.wOld) + "</p>").join("");
    box.appendChild(w);
  }

  const zb = document.createElement("div"); zb.className = "zbar";
  zb.innerHTML = `<button type="button" aria-label="${T.zout}" title="${T.zout}">−</button><button type="button" aria-label="${T.zin}" title="${T.zin}">+</button><button type="button" aria-label="${T.zreset}" title="${T.zreset}">↺</button>`;
  box.appendChild(zb);
  const ch = document.createElement("div"); ch.className = "chart"; svgEl = draw(res); ch.appendChild(svgEl); box.appendChild(ch);
  initZoom(ch, svgEl, zb);
  const hp = document.createElement("p"); hp.className = "help chart-hint"; hp.textContent = T.chartHint; box.appendChild(hp);
  const act = document.createElement("div"); act.className = "act"; act.innerHTML = `<button type="button" id="b1">${T.svg}</button><button type="button" id="b2">${T.png}</button>`; box.appendChild(act);

  const gd = document.createElement("details"); gd.className = "guide"; gd.open = !!res.example;
  gd.innerHTML = `<summary>${T.gT}</summary><ul>${T.gL.map(x => `<li>${x}</li>`).join("")}</ul><p>${T.gD}</p>`;
  box.appendChild(gd);

  const as = document.createElement("div"); as.className = "sec";
  as.innerHTML = `<p class="note">${T.tzLine(res.tz, offStr(res.offMin))}</p>`
    + (res.sens ? `<p class="note">${T.sens(T.sign[readSign(res.sens.asc)], deg(res.sens.asc), fmtN(res.sens.shift, 1), res.sens.lim < 1e9 ? res.sens.lim : 0)}</p>` : "");
  box.appendChild(as);

  const rows = [];
  if(res.known){ rows.push([T.asc, res.h.asc, null, T.ascm, "A"]); rows.push([T.mc, res.h.mc, null, "", "M"]); }
  res.lon.forEach((l, i) => { if(l != null) rows.push([T.body[i], l, res.known ? houseOf(l, res.h.c) : "", i < 5 ? T.mean[i] : "", i, res.rx[i]]); });

  const q = document.createElement("div");
  q.innerHTML = `<h2>${T.quick}</h2><p class="note" style="margin:2px 0 10px">${T.quickIntro}</p><div class="quick"></div>`;
  const qs = q.lastChild;
  (res.known ? [rows[0]] : []).concat(rows.filter(r => typeof r[4] == "number" && r[4] < 5)).forEach(r => {
    const s = readSign(r[1]), dv = document.createElement("div"); dv.className = "q"; const isP = typeof r[4] == "number";
    dv.innerHTML = `<b><span class="g sym">${r[4] == "A" ? "↑" : PG[r[4]]}</span>${r[0]}: ${T.sign[s]} <span class="sym">${SIGN[s]}</span></b><p>${r[3]} – ${isP ? psText(r[4], s) : T.kw[s]}</p>`
      + (isP && res.known ? `<p>${T.hn(r[2])}: ${housePlanet(r[4], r[2])}</p>` : "");
    qs.appendChild(dv);
  });
  box.appendChild(q);

  const tb = document.createElement("div"); tb.className = "tw";
  tb.innerHTML = `<h2>${T.full}</h2><table><thead><tr>${T.th.map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr><td>${typeof r[4] == "number" ? `<span class="sym" style="color:var(--amber)">${PG[r[4]]}</span> ` : ""}${r[0]}</td><td><span class="sym">${SIGN[readSign(r[1])]}</span> ${T.sign[readSign(r[1])]}</td><td>${deg(r[1])}${r[5] ? " ℞" : ""}</td><td>${r[2] || ""}</td></tr>`).join("")}</tbody></table>`;
  box.appendChild(tb);

  box.appendChild(aspectGrid(res, T));
  box.appendChild(patternSection(res, T));
  box.appendChild(distribution(res, T));
  box.appendChild(starTable(res, T));
  box.appendChild(astroView(res, T));

  const n = document.createElement("p"); n.className = "note";
  n.textContent = (res.known ? "" : T.untime + " ") + T.rx + ". " + T.note + (res.known ? " " + T.hsn[res.sys] + "." : "") + (res.ext && res.known ? " " + T.fort : "");
  box.appendChild(n);
  $("b1").onclick = () => save(false); $("b2").onclick = () => save(true);
}

/* ---------- Explanations: hover (mouse), tap/click (pins), focus + Enter (keyboard) ---------- */
const tipEl = $("tip");
let pinned = false;
function tipHTML(key){
  const res = window.RES; if(!res) return "";
  const T = L[lang], q = key.split("|"), k = q[0], cu = res.known ? res.h.c : null;
  const pl = j => `<span class="sym">${PG[j]}</span> ${T.body[j]}`;
  const sg = l => { const s = readSign(l); return `${T.sign[s]} <span class="sym">${SIGN[s]}</span> ${deg(l)}`; };
  const head = (ti, su) => `<h3>${ti}</h3>` + (su ? `<div class="sub">${su}</div>` : "");
  const list = a => a.length ? a.map(pl).join(", ") : T.none;
  if(k === "p"){
    const i = +q[1], l = res.lon[i], s = readSign(l);
    let su = sg(l);
    if(cu) su += " · " + T.hn(houseOf(l, cu));
    if(res.rx[i]) su += " · ℞ " + T.retro;
    let b = `<p>${T.pd[i]}</p>`;
    if(i >= 7 && i <= 9) b += `<p>${T.slow}</p>`;
    if(i === 1 && !res.known) b += `<p>${T.moonN}</p>`;
    b += `<p><b>${T.ins} ${T.sign[s]}:</b> ${psText(i, s)}</p>`;
    if(cu){ const h = houseOf(l, cu); b += `<p><b>${T.hn(h)}:</b> ${housePlanet(i, h)}</p>`; }
    return head(pl(i), su) + b;
  }
  if(k === "s"){
    const i = +q[1], inn = res.lon.map((l, j) => l != null && readSign(l) === i ? j : -1).filter(j => j >= 0);
    return head(`<span class="sym">${SIGN[i]}</span> ${T.sign[i]}`, `${T.el[i % 4]} · ${T.mo[i % 3]}`)
      + `<p>${T.eld[i % 4]}</p><p>${T.mod[i % 3]}</p><p><b>${T.typ}</b> ${T.kw[i]}.</p><p><b>${T.here}</b> ${list(inn)}</p>`;
  }
  if(k === "h" && cu){
    const n = +q[1], inn = res.lon.map((l, j) => l != null && houseOf(l, cu) === n ? j : -1).filter(j => j >= 0);
    return head(T.hn(n), `${T.starts} ${sg(cu[n - 1])}`) + `<p>${T.hs[n - 1]}</p><p><b>${T.hereH}</b> ${list(inn)}</p>`;
  }
  if(k === "x" && res.known){
    const key2 = q[1], v = {A: res.h.asc, D: nm(res.h.asc + 180), M: res.h.mc, I: nm(res.h.mc + 180)}[key2];
    return head(T.axn[key2], sg(v)) + `<p>${T.axd[key2]}</p>`;
  }
  if(k === "a"){
    const nameOf = v => v === "A" ? T.asc : v === "M" ? T.mc : pl(+v), ti = +q[3];
    const orb = lang === "fi" ? q[4].replace(".", ",") : q[4];
    return head(`${T.an[ti]} (${ASPT[ti][0]}°)`, `${nameOf(q[1])} – ${nameOf(q[2])}`)
      + `<p>${pairText(q[1], q[2])}</p><p>${T.ad[ti]}</p><p class="dim">${T.orbL}: ${orb}°${q[5] === "1" ? " · " + T.apl : q[5] === "0" ? " · " + T.sep : ""}</p>`;
  }
  return "";
}
function placeTip(x, y){
  tipEl.style.left = "0px"; tipEl.style.top = "0px";
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight, vw = innerWidth, vh = innerHeight;
  let lx = x + 16, ty = y + 16;
  if(lx + w > vw - 8) lx = Math.max(8, x - w - 16);
  if(ty + h > vh - 8) ty = Math.max(8, y - h - 16);
  tipEl.style.left = lx + "px"; tipEl.style.top = ty + "px";
}
function showTip(node, x, y, pin){
  const html = tipHTML(node.dataset.tip); if(!html) return;
  tipEl.innerHTML = `<button type="button" class="x" aria-label="${t("close")}">×</button>` + html;
  tipEl.classList.add("on"); tipEl.classList.toggle("pin", !!pin); pinned = !!pin;
  placeTip(x, y);
}
function hideTip(){ tipEl.classList.remove("on", "pin"); pinned = false; }
const tipNode = e => { const n = e.target.closest && e.target.closest("[data-tip]"); return n && n.closest(".chart,.at") ? n : null; };
const nodeXY = n => { const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

document.addEventListener("pointerover", e => {
  if(e.pointerType !== "mouse" || pinned) return;
  const n = tipNode(e);
  if(n) showTip(n, e.clientX, e.clientY, false); else hideTip();
});
document.addEventListener("pointermove", e => {
  if(e.pointerType === "mouse" && !pinned && tipEl.classList.contains("on")) placeTip(e.clientX, e.clientY);
});
document.addEventListener("click", e => {
  if(e.target.closest(".x")){ hideTip(); return; }
  const n = tipNode(e);
  if(n){ showTip(n, e.clientX, e.clientY, true); return; }
  if(!e.target.closest("#tip")) hideTip();
});
document.addEventListener("focusin", e => {
  const n = tipNode(e);
  if(n && !pinned){ const [x, y] = nodeXY(n); showTip(n, x, y, false); }
});
document.addEventListener("focusout", e => { if(!pinned && tipNode(e)) hideTip(); });
document.addEventListener("keydown", e => {
  if(e.key === "Escape"){ hideTip(); return; }
  if(e.key === "Enter" || e.key === " "){
    const n = tipNode(e);
    if(n){ e.preventDefault(); const [x, y] = nodeXY(n); showTip(n, x, y, true); }
  }
});
window.addEventListener("scroll", () => { if(innerWidth > 700) hideTip(); }, {passive: true});

/* ---------- Saved birth details (same localStorage key as the language) ---------- */
function saveBirth(){
  store.d = $("d").value; store.tm = $("tm").value; store.unk = $("unk").checked; store.man = $("man").checked;
  if(store.man){ store.la = $("la").value; store.lo = $("lo").value; store.tz = $("tz").value; delete store.cc; delete store.place; }
  else if(cur){ store.cc = cs.value; store.place = cur.n; delete store.la; delete store.lo; delete store.tz; }
  saveStore();
}
function restoreBirth(){
  const s = store;
  if(typeof s.d !== "string" || !/^\d{4}-\d\d-\d\d$/.test(s.d)) return;
  $("d").value = s.d;
  if(typeof s.tm === "string" && /^\d\d:\d\d$/.test(s.tm)) $("tm").value = s.tm;
  $("unk").checked = !!s.unk; $("tm").disabled = !!s.unk;
  let tzOk = false;
  if(s.man){ try{ new Intl.DateTimeFormat("en", {timeZone: s.tz}); tzOk = true; }catch(e){} }
  if(s.man && tzOk){
    $("man").checked = true; $("mb").style.display = "grid"; pi.disabled = cs.disabled = true;
    $("la").value = s.la; $("lo").value = s.lo; $("tz").value = s.tz;
  } else {
    const co = DB.find(c => c.cc === s.cc), c = co && co.cs.find(x => x.n === s.place);
    if(c){ cs.value = co.cc; cur = c; pi.value = c.n; $("tz").value = co.cs[0].tz; }
  }
}
$("rs").addEventListener("click", () => {
  ["d", "tm", "unk", "cc", "place", "man", "la", "lo", "tz"].forEach(k => delete store[k]);
  saveStore();
  $("d").value = "2000-01-01"; $("tm").value = "12:00"; $("unk").checked = false; $("tm").disabled = false;
  $("man").checked = false; $("mb").style.display = "none"; pi.disabled = cs.disabled = false;
  $("la").value = "60.17"; $("lo").value = "24.94"; $("tz").value = "Europe/Helsinki";
  cs.value = "FI"; cur = {n:"Helsinki", lat:60.17, lon:24.94, tz:"Europe/Helsinki"}; pi.value = "Helsinki"; sg.hidden = true;
  $("er").textContent = ""; userSubmitted = false; Z.s = 1; Z.cx = Z.cy = 400;
  const r = calc(); if(r){ window.RES = r; render(); }
});

/* ---------- Chart zoom: buttons, double-tap/click, pinch, drag to pan, Ctrl+wheel ---------- */
const ZF = {x:-30, y:-30, w:860}, ZMAX = 6;
const Z = {s:1, cx:400, cy:400};   // scale and view centre; kept across re-renders
function initZoom(ch, svg, bar){
  const btn = bar.querySelectorAll("button"), ptrs = new Map();
  let drag = null, pinch = null, lastTap = null, skipUntil = 0;
  const apply = () => {
    Z.s = Math.min(ZMAX, Math.max(1, Z.s));
    const w = ZF.w / Z.s, lo = ZF.x + w / 2, hi = ZF.x + ZF.w - w / 2;
    Z.cx = Math.min(hi, Math.max(lo, Z.cx)); Z.cy = Math.min(hi, Math.max(lo, Z.cy));
    svg.setAttribute("viewBox", (Z.cx - w / 2) + " " + (Z.cy - w / 2) + " " + w + " " + w);
    const on = Z.s > 1.001;
    ch.classList.toggle("zoomed", on);
    btn[0].disabled = btn[2].disabled = !on;
    btn[1].disabled = Z.s >= ZMAX - 0.001;
  };
  // Zoom to scale s keeping the chart point under screen position (px, py) in place.
  const zoomAt = (px, py, s) => {
    const r = svg.getBoundingClientRect(), fx = (px - r.left) / r.width, fy = (py - r.top) / r.height;
    const w0 = ZF.w / Z.s, x0 = Z.cx - w0 / 2 + fx * w0, y0 = Z.cy - w0 / 2 + fy * w0;
    Z.s = s < 1.05 ? 1 : Math.min(ZMAX, s);
    const w1 = ZF.w / Z.s;
    Z.cx = x0 - fx * w1 + w1 / 2; Z.cy = y0 - fy * w1 + w1 / 2;
    hideTip(); apply();
  };
  const mid = () => { const r = svg.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  btn[0].onclick = () => zoomAt(...mid(), Z.s / 1.5);
  btn[1].onclick = () => zoomAt(...mid(), Z.s * 1.5);
  btn[2].onclick = () => { Z.s = 1; Z.cx = Z.cy = 400; hideTip(); apply(); };

  ch.addEventListener("pointerdown", e => {
    ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if(ptrs.size === 1) drag = {x:e.clientX, y:e.clientY, t:performance.now(), moved:false, cap:false, id:e.pointerId};
    else if(ptrs.size === 2){
      if(drag) drag.moved = true;
      const [a, b] = [...ptrs.values()];
      pinch = {d:Math.hypot(a.x - b.x, a.y - b.y) || 1, s:Z.s, mx:(a.x + b.x) / 2, my:(a.y + b.y) / 2};
    }
  });
  ch.addEventListener("pointermove", e => {
    const p = ptrs.get(e.pointerId); if(!p) return;
    const ox = p.x, oy = p.y; p.x = e.clientX; p.y = e.clientY;
    if(ptrs.size >= 2 && pinch){
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const r = svg.getBoundingClientRect(), w = ZF.w / Z.s;
      Z.cx -= (mx - pinch.mx) * w / r.width; Z.cy -= (my - pinch.my) * w / r.height;
      pinch.mx = mx; pinch.my = my;
      zoomAt(mx, my, pinch.s * d / pinch.d);
      return;
    }
    if(!drag || e.pointerId !== drag.id) return;
    if(!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
    drag.moved = true;
    if(Z.s > 1.001){
      if(!drag.cap){ try{ ch.setPointerCapture(e.pointerId); }catch(_){} drag.cap = true; hideTip(); }
      const r = svg.getBoundingClientRect(), w = ZF.w / Z.s;
      Z.cx -= (e.clientX - ox) * w / r.width; Z.cy -= (e.clientY - oy) * w / r.height;
      apply();
    }
  });
  const end = e => {
    if(!ptrs.delete(e.pointerId)) return;
    if(ptrs.size < 2) pinch = null;
    if(e.type === "pointercancel"){ drag = null; return; }
    if(drag && e.pointerId === drag.id){
      const d = drag, now = performance.now(); drag = null;
      if(d.cap){ skipUntil = now + 400; return; }
      if(!d.moved && now - d.t < 500){
        if(lastTap && now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30){
          lastTap = null; skipUntil = now + 400;
          zoomAt(e.clientX, e.clientY, Z.s > 1.001 ? 1 : 2.5);   // double-tap / double-click toggles zoom
        } else lastTap = {t:now, x:e.clientX, y:e.clientY};
      }
    }
    if(!drag && ptrs.size === 1){   // one finger left after a pinch: keep panning with it
      const [id, p] = [...ptrs.entries()][0];
      drag = {x:p.x, y:p.y, t:performance.now(), moved:true, cap:false, id};
    }
  };
  ch.addEventListener("pointerup", end);
  ch.addEventListener("pointercancel", end);
  // Swallow the click that follows a drag or a double-tap so it does not also open a tooltip.
  ch.addEventListener("click", e => { if(performance.now() < skipUntil){ e.stopPropagation(); e.preventDefault(); } }, true);
  ch.addEventListener("wheel", e => {
    if(!e.ctrlKey) return;
    e.preventDefault(); zoomAt(e.clientX, e.clientY, Z.s * Math.exp(-e.deltaY * 0.01));
  }, {passive:false});
  apply();
}

function save(png){
  const x = svgEl.cloneNode(true); x.setAttribute("xmlns", "http://www.w3.org/2000/svg"); x.setAttribute("viewBox", "-30 -30 860 860");
  x.querySelectorAll(".hit").forEach(e => e.remove());
  x.querySelectorAll("[data-tip]").forEach(e => ["data-tip", "tabindex", "role", "aria-label"].forEach(a => e.removeAttribute(a)));
  x.querySelectorAll(".sym").forEach(e => e.setAttribute("font-family", "Segoe UI Symbol,Noto Sans Symbols 2,Apple Symbols,DejaVu Sans,serif"));
  x.querySelectorAll("text:not(.sym)").forEach(e => e.setAttribute("font-family", "Georgia,serif"));
  const bg = el("rect", {x: -30, y: -30, width: 860, height: 860, fill: "#0b0714"}); x.insertBefore(bg, x.firstChild);
  const s = new XMLSerializer().serializeToString(x), dl = (href, n) => { const a = document.createElement("a"); a.href = href; a.download = n; a.click(); };
  if(!png){ const u = URL.createObjectURL(new Blob([s], {type: "image/svg+xml"})); dl(u, "birthchart.svg"); setTimeout(() => URL.revokeObjectURL(u), 2000); return; }
  const im = new Image();
  im.onload = () => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 1600;
    cv.getContext("2d").drawImage(im, 0, 0, 1600, 1600);
    cv.toBlob(b => { const u = URL.createObjectURL(b); dl(u, "birthchart.png"); setTimeout(() => URL.revokeObjectURL(u), 2000); });
  };
  im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
}

$("f").addEventListener("submit", e => {
  Z.s = 1; Z.cx = Z.cy = 400;
  userSubmitted = true;
  e.preventDefault();
  const r = calc();
  if(!r) return;
  window.RES = r;
  render();
  saveBirth();
  // Move the newly calculated chart into view instead of leaving the user at the form.
  requestAnimationFrame(() => $("res").scrollIntoView({behavior:"smooth", block:"start"}));
});

function apply(){
  document.documentElement.lang = lang;
  document.title = lang === "fi"
    ? "Syntymäkartta – Ilmainen syntymäkarttalaskuri"
    : "Birth Chart – Free Natal Chart Calculator";
  $("lb").textContent = lang === "fi" ? "In English" : "Suomeksi";
  $("title").childNodes[0].textContent = lang === "fi" ? "Syntymäkartta" : "Birth Chart";
  $("credit").innerHTML = lang === "fi"
    ? '<a href="https://github.com/Millaceedee/" target="_blank" rel="noopener noreferrer" style="color:inherit">Millaceedee</a> © 2026. Lisensoitu MIT-lisenssillä. Tähtitieteelliset laskelmat: <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener noreferrer" style="color:inherit">Astronomy Engine</a>, Don Cross.'
    : '<a href="https://github.com/Millaceedee/" target="_blank" rel="noopener noreferrer" style="color:inherit">Millaceedee</a> © 2026. Licensed under the MIT License. Astronomical calculations: <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener noreferrer" style="color:inherit">Astronomy Engine</a> by Don Cross.';
  document.querySelectorAll("[data-t]").forEach(e => e.textContent = t(e.dataset.t));
  $("rs").title = t("resetT");
  fillCountries(); if(cur) pi.value = cur.n;
}
$("lb").onclick = () => { lang = lang === "fi" ? "en" : "fi"; store.lang = lang; saveStore(); apply(); if(window.RES) render(); };
fillCountries(); cs.value = "FI"; apply(); restoreBirth();

window.addEventListener("DOMContentLoaded", () => {
  const r = calc();
  if(r){ window.RES = r; render(); }
});

(() => {
  const f = document.getElementById("f");
  const map = {d:"hDate", tm:"hTime", unk:"hTime", c:"hint", p:"hint", man:"hMan", hs:"hHs", asp:"hHs", ext:"hExt"};
  const show = on => e => {
    const k = map[e.target.id]; if (!k) return;
    f.querySelectorAll('.help').forEach(h => h.classList.remove("show"));
    if (on) { const h = f.querySelector('.help[data-t="' + k + '"]'); if (h) h.classList.add("show"); }
  };
  f.addEventListener("focusin", show(true));
  f.addEventListener("focusout", show(false));
})();
