// Extra sections added on top of the existing chart (nothing here changes an existing calculation):
//   house cusps, chart ruler, lunar phase, hemispheres and quadrants, exact aspect orbs, essential dignities.
// Loaded before app.js. It only defines window.EXTRA_TXT (texts, merged into L by app.js) and window.EXTRAS
// (functions called from render() and tipHTML()). Helpers of app.js (L, lang, deg, fmtN, houseOf, aspectRes ...)
// are looked up at call time, so the load order does not matter.
(function(){
"use strict";

/* ------------------------------------------------------------------ texts ------------------------------------------------------------------ */
window.EXTRA_TXT = {
fi: {
  x_stSum0: "Yksikään taulukon 17 tähdestä ei ole oletusrajan (1°) sisällä planeetasta, pisteestä tai akselista. Tämä ei tarkoita, ettei kartalla voisi olla merkittäviä kiinteitä tähtiä: rajaus on vain oletus, ja taulukossa on rajallinen valikoima tähtiä. Taulukko näyttää, missä tähdet ovat ja mikä on lähin kohde.",
  x_stSum1: n => `Kartassasi on ${n === 1 ? "yksi kiinteän tähden konjunktio" : n + " kiinteän tähden konjunktiota"} (alle 1°):`,
  x_stRef: "Kaikkien tähtien perinteiset merkitykset (yleistietoa, ei kerro karttasi omia piirteitä)",
  x_needTime: "Tämä osio vaatii tarkan syntymäajan: nousumerkki, akselit ja talot voidaan laskea vasta, kun kellonaika on tiedossa.",
  // quick readings for Jupiter..Pluto
  x_mean: ["Kasvu, onni ja merkityksen etsintä", "Vastuu, rajat ja kypsyminen", "Vapaus, uudistus ja yllätykset", "Unelmat, intuitio ja mielikuvitus", "Syvä muutos ja voima"],
  // house cusps
  x_cuT: "Huoneiden kärjet",
  x_cuN: "Talojen alkukohdat nykyisellä talojärjestelmällä (sama laskenta kuin kartassa ja talotaulukossa). Aste on merkin sisällä; eläinradan sijainti on ekliptinen pituus 0–360° (0° = kevätpäiväntasaus, ei Oinaan alku).",
  x_cuTh: ["Talo", "Alkamismerkki", "Aste merkissä", "Eläinradan sijainti"],
  x_cuPolar: "Napa-alueella Placidus- ja Koch-talot eivät ole määriteltävissä, joten kärjet on laskettu Porphyry-jaolla, kuten kartassakin.",
  // chart ruler
  x_ruT: "Kartan hallitsija",
  x_ruN: "Nousumerkin perinteinen hallitsijaplaneetta. Perinteisessä järjestelmässä merkkejä hallitsee vain seitsemän klassista planeettaa (esim. Skorpioni = Mars, Vesimies = Saturnus, Kalat = Jupiter).",
  x_ruRows: ["Nousumerkki", "Hallitseva planeetta", "Hallitsijan merkki", "Hallitsijan huone", "Hallitsijan liike"],
  x_ruMove: ["Suora", "Taaksepäinen ℞"],
  x_ruI: (a, r) => `Nousumerkki ${a} kuvaa tapaasi astua maailmaan, ja sen hallitsija ${r} toimii symbolisesti kartan ohjaajana: sen merkki ja talo kertovat, mihin elämänalueeseen suuntaat ja millä tavalla.`,
  x_ruSign: (r, s) => `${r} merkissä ${s}`,
  x_ruRx: "Taaksepäinen hallitsija: ohjaajan energia kääntyy usein ensin sisäänpäin. Asiat kypsyvät omassa tahdissaan, ja ne vaativat uudelleenarviointia ennen kuin ne löytävät suuntansa.",
  // lunar phase
  x_phT: "Syntymän kuunvaihe",
  x_phN: "Vaihe lasketaan Kuun ja Auringon ekliptisten pituuksien erotuksesta (Kuu − Aurinko, 0–360°) ja jaetaan kahdeksaan 45° osaan, joiden keskikohdat ovat 0°, 45°, … 315°. Valaistuneisuus on Kuun kiekon valaistu osuus samalta hetkeltä (Astronomy Engine; huomioi Kuun ekliptisen leveyden sekä Auringon ja Kuun etäisyydet). Kuvake näyttää Kuun pohjoiselta pallonpuoliskolta katsottuna.",
  x_phRows: ["Vaihe", "Pituuserotus (Kuu − Aurinko)", "Valaistuneisuus", "Suunta"],
  x_phDir: ["Kasvava Kuu (valo lisääntyy)", "Vähenevä Kuu (valo vähenee)", "–"],
  x_phNames: ["Uusikuu", "Kasvava sirppi", "Ensimmäinen neljännes", "Kasvava kupera Kuu", "Täysikuu", "Vähenevä kupera Kuu", "Viimeinen neljännes", "Vähenevä sirppi"],
  x_phTxt: [
    "Uusi alku ja siemen: vaisto ja tahto ovat yhtä, ja asiat lähtevät liikkeelle sisäisestä tarpeesta. Symbolisesti spontaani, aloittava ja vielä itseään etsivä luonne.",
    "Ponnistelun ja vakiintumisen vaihe: uusi suunta kohtaa ensimmäisen vastuksen. Symbolisesti sinnikäs ja kasvuhakuinen luonne, joka irrottautuu vanhoista tavoista.",
    "Toiminnan ja ratkaisujen vaihe: jännite ajaa tekemään päätöksiä ja rakentamaan. Symbolisesti toimelias luonne, joka kasvaa haasteista.",
    "Hiomisen ja tarkentamisen vaihe: halu parantaa, oppia ja kehittää taitoa. Symbolisesti analyyttinen, täydellisyyttä tavoitteleva ja valmistautuva luonne.",
    "Valaistumisen ja suhteiden vaihe: tietoisuus ja tunne ovat vastakkain, ja asiat tulevat näkyviin. Symbolisesti objektiivinen, suhdekeskeinen ja tasapainoa etsivä luonne.",
    "Jakamisen vaihe: opittu halutaan antaa eteenpäin. Symbolisesti opettava, kokemuksiaan jakava ja merkitystä etsivä luonne.",
    "Uudelleenarvioinnin vaihe: vanhoja rakenteita kyseenalaistetaan ja niistä luovutaan. Symbolisesti kriittinen, uudistava ja oman näkemyksensä rakentava luonne.",
    "Päättämisen ja antautumisen vaihe: kierto lähestyy loppuaan ja vanha päästetään irti. Symbolisesti herkkä, intuitiivinen ja tulevaan suuntautunut luonne."
  ],
  // hemispheres and quadrants
  x_hqT: "Puoliskot ja kvadrantit",
  x_hqN: "Rajaukset: ASC–DSC-akseli jakaa ylä- ja alapuoliskon (yläpuoli = talojen 7–12 alue) ja MC–IC-akseli itä- ja länsipuoliskon (itä = talojen 10–3 alue). Neljä kvadranttia ovat näiden leikkaukset: 1. ASC–IC, 2. IC–DSC, 3. DSC–MC, 4. MC–ASC. Käytössä on vain akselien geometria, joten talojärjestelmä ei vaikuta tulokseen. Mukana ovat Aurinko–Pluto ekliptisen pituutensa mukaan (leveyttä ei oteta huomioon); tasan akselin kohdalla oleva planeetta kuuluu alueeseen, joka alkaa kyseisestä akselista eläinradan suuntaan. Painotus: 7 tai enemmän kymmenestä on selvä, 6 on lievä; kvadrantissa korostuminen vaatii vähintään 4 planeettaa.",
  x_hqTh: ["Alue", "Planeetat", "Lkm"],
  x_hqHalf: ["Itäinen (talot 10–3)", "Läntinen (talot 4–9)", "Ylä (horisontin yläpuoli, talot 7–12)", "Ala (horisontin alapuoli, talot 1–6)"],
  x_hqQ: ["1. kvadrantti (ASC–IC, talot 1–3)", "2. kvadrantti (IC–DSC, talot 4–6)", "3. kvadrantti (DSC–MC, talot 7–9)", "4. kvadrantti (MC–ASC, talot 10–12)"],
  x_hqSlight: "Lievä",
  x_hqE: "Itäpuoliskon painotus: toimit omasta aloitteestasi ja muovaat olosuhteita itse; itseohjautuvuus korostuu.",
  x_hqW: "Länsipuoliskon painotus: muotoudut olosuhteiden ja muiden ihmisten kautta; yhteistyö ja reagointi korostuvat.",
  x_hqU: "Yläpuoliskon painotus: elämä suuntautuu ulospäin, näkyvään toimintaan, ihmisiin ja yhteiskuntaan.",
  x_hqL: "Alapuoliskon painotus: elämä suuntautuu sisäänpäin, yksityiseen, kotiin ja oman sisimmän kuunteluun.",
  x_hqBalEW: "Itä ja länsi ovat tasapainossa: sekä oma aloite että mukautuminen ovat käytössä.",
  x_hqBalUL: "Ylä- ja alapuolisko ovat tasapainossa: sekä ulospäin että sisäänpäin suuntautuminen ovat käytössä.",
  x_hqQT: ["Itsen kvadrantti: oma persoona, identiteetti, arvot ja perustan rakentaminen.", "Sisäisen elämän kvadrantti: koti, juuret, tunteet, luovuus ja arki.", "Suhteiden kvadrantti: kumppanuudet, yhteiset resurssit, oppiminen ja maailmankatsomus.", "Yhteiskunnan kvadrantti: ura, yhteisöt, ihanteet ja julkinen rooli."],
  x_hqQBal: "Kvadranteissa ei ole selvää painotusta (yhdessäkään ei ole vähintään 4 planeettaa).",
  x_hqQHead: "Korostuva kvadrantti",
  // aspect details
  x_alT: "Aspektien tarkat orbit",
  x_alN: "Sama aspektijärjestelmä kuin aspektitaulukossa: tässä ne on vain eritelty. Orbi on todellisen kulmaeron poikkeama aspektin tarkasta kulmasta. Sallittu orbi on aspektin perusorbi kerrottuna kohteiden kertoimilla (valot leveämpi, ulkoplaneetat ja lasketut pisteet kapeampi). Lajittelu: tiukimmat ensin.",
  x_alTh: ["Kohteet", "Aspekti", "Tarkka kulma", "Todellinen kulmaero", "Orbi", "Sallittu orbi", "Suunta"],
  x_alNone: "Valituilla asetuksilla ei löytynyt aspekteja.",
  x_alCount: n => `${n} aspektia`,
  x_tip: (ex, sep, orb, max) => `Tarkka kulma ${ex}° · todellinen kulmaero ${sep} · orbi ${orb} (sallittu ${max})`,
  // dignities
  x_dgT: "Planeettojen hallinnat ja vahvuudet",
  x_dgN: "Perinteisen astrologian symbolinen luokittelu, ei tähtitieteellinen mittaus: se ei kerro planeetan kirkkaudesta, etäisyydestä tai todellisesta voimasta. Mukana ovat seitsemän klassista planeettaa; Uranus, Neptunus, Pluto ja solmut eivät kuulu perinteiseen järjestelmään. Tulkinnat ovat yleisluontoisia.",
  x_dgTh: ["Planeetta", "Merkki", "Asema", "Symbolinen merkitys"],
  x_dgRefT: "Perinteiset hallinnat (taulukko)",
  x_dgRefTh: ["Planeetta", "Oma merkki", "Ylennys", "Vastamerkki", "Alennus"],
  x_dgSt: {dom: "Oma merkki", ex: "Ylennys", det: "Vastamerkki", fall: "Alennus", none: "Ei erityisasemaa"},
  x_dgTx: {
    dom: "Planeetta on kotonaan: sen ominaisuudet ilmenevät luontevasti ja omilla ehdoillaan.",
    ex: "Planeetta on kunniapaikalla: se pääsee ilmaisemaan parhaita puoliaan.",
    det: "Planeetta on kotinsa vastakkaisessa merkissä: ilmaisu vaatii enemmän sopeutumista ja tietoista työtä.",
    fall: "Planeetta on ylennyksensä vastakkaisessa merkissä: ominaisuudet jäävät helposti varjoon tai ilmenevät epävarmasti.",
    none: "Merkki ei ole planeetan oma, ylennys, vastamerkki eikä alennus (muita perinteisiä vahvuuksia, kuten kolmikkoa, ei ole arvioitu)."
  },
  x_dgBoth: "ja",
  x_dgMoon: "Kuu liikkuu yli 12° päivässä, joten sen merkki on kellonajan puuttuessa vain suuntaa antava."
},
en: {
  x_stSum0: "None of the 17 stars in the table is within the default limit (1°) of a planet, point or axis. This does not mean the chart has no significant fixed stars: the limit is only a default and the table covers a limited selection of stars. The table shows where the stars are and the nearest point for each.",
  x_stSum1: n => `Your chart has ${n === 1 ? "one fixed-star conjunction" : n + " fixed-star conjunctions"} (within 1°):`,
  x_stRef: "Traditional meanings of all the stars (general information, not features of your chart)",
  x_needTime: "This section needs an exact birth time: the ascendant, axes and houses can only be calculated when the time is known.",
  x_mean: ["Growth, luck and the search for meaning", "Responsibility, limits and maturing", "Freedom, reform and surprises", "Dreams, intuition and imagination", "Deep change and power"],
  x_cuT: "House cusps",
  x_cuN: "Where each house begins, using the current house system (the same calculation as the chart and the house table). The degree is within the sign; the zodiac position is the ecliptic longitude 0–360° (0° = the March equinox, not the start of Aries).",
  x_cuTh: ["House", "Starting sign", "Degree in sign", "Zodiac position"],
  x_cuPolar: "In the polar regions Placidus and Koch houses are not defined, so the cusps are calculated with the Porphyry division, as in the chart.",
  x_ruT: "Chart ruler",
  x_ruN: "The traditional ruling planet of the rising sign. In the traditional system only the seven classical planets rule signs (e.g. Scorpio = Mars, Aquarius = Saturn, Pisces = Jupiter).",
  x_ruRows: ["Rising sign", "Ruling planet", "Ruler’s sign", "Ruler’s house", "Ruler’s motion"],
  x_ruMove: ["Direct", "Retrograde ℞"],
  x_ruI: (a, r) => `The rising sign ${a} describes how you step into the world, and its ruler ${r} acts symbolically as the chart’s guide: its sign and house show which area of life you steer toward and in what way.`,
  x_ruSign: (r, s) => `${r} in ${s}`,
  x_ruRx: "A retrograde ruler: the guide’s energy often turns inward first. Things mature at their own pace and need re-evaluation before they find their direction.",
  x_phT: "Lunar phase at birth",
  x_phN: "The phase is taken from the difference between the ecliptic longitudes of the Moon and the Sun (Moon − Sun, 0–360°) and divided into eight 45° parts centred on 0°, 45°, … 315°. Illumination is the lit fraction of the Moon’s disc at the same instant (Astronomy Engine; it accounts for the Moon’s ecliptic latitude and the Sun and Moon distances). The icon shows the Moon as seen from the northern hemisphere.",
  x_phRows: ["Phase", "Longitude difference (Moon − Sun)", "Illumination", "Direction"],
  x_phDir: ["Waxing Moon (light increasing)", "Waning Moon (light decreasing)", "–"],
  x_phNames: ["New Moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full Moon", "Waning gibbous", "Last quarter", "Waning crescent"],
  x_phTxt: [
    "A new beginning and a seed: instinct and will are one, and things start from an inner need. Symbolically a spontaneous, initiating nature that is still finding itself.",
    "A phase of effort and settling in: the new direction meets its first resistance. Symbolically a persistent, growth-seeking nature breaking away from old habits.",
    "A phase of action and decisions: tension pushes you to decide and to build. Symbolically an active nature that grows through challenges.",
    "A phase of refining and sharpening: the wish to improve, learn and develop skill. Symbolically an analytical, perfection-seeking and preparing nature.",
    "A phase of illumination and relationship: awareness and feeling face each other, and things come into view. Symbolically an objective, relationship-centred nature seeking balance.",
    "A phase of sharing: what has been learned is meant to be passed on. Symbolically a teaching nature that shares experience and looks for meaning.",
    "A phase of re-evaluation: old structures are questioned and let go. Symbolically a critical, reforming nature that builds its own view.",
    "A phase of closing and surrender: the cycle nears its end and the old is released. Symbolically a sensitive, intuitive nature oriented toward what comes next."
  ],
  x_hqT: "Hemispheres and quadrants",
  x_hqN: "Rules: the ASC–DSC axis divides the upper and lower halves (upper = the area of houses 7–12) and the MC–IC axis the eastern and western halves (east = the area of houses 10–3). The four quadrants are their intersections: 1. ASC–IC, 2. IC–DSC, 3. DSC–MC, 4. MC–ASC. Only the geometry of the axes is used, so the house system does not affect the result. Sun to Pluto are included by ecliptic longitude (latitude is ignored); a planet exactly on an axis belongs to the region that begins at that axis in the direction of the zodiac. Emphasis: 7 or more of ten is clear, 6 is slight; a quadrant is emphasised with at least 4 planets.",
  x_hqTh: ["Region", "Planets", "No."],
  x_hqHalf: ["Eastern (houses 10–3)", "Western (houses 4–9)", "Upper (above the horizon, houses 7–12)", "Lower (below the horizon, houses 1–6)"],
  x_hqQ: ["Quadrant 1 (ASC–IC, houses 1–3)", "Quadrant 2 (IC–DSC, houses 4–6)", "Quadrant 3 (DSC–MC, houses 7–9)", "Quadrant 4 (MC–ASC, houses 10–12)"],
  x_hqSlight: "Slight",
  x_hqE: "Eastern emphasis: you act on your own initiative and shape circumstances yourself; self-direction stands out.",
  x_hqW: "Western emphasis: you take shape through circumstances and other people; cooperation and responding stand out.",
  x_hqU: "Upper emphasis: life is directed outward, to visible activity, people and society.",
  x_hqL: "Lower emphasis: life is directed inward, to the private, to home and to listening to your own depths.",
  x_hqBalEW: "East and west are balanced: both your own initiative and adapting are in use.",
  x_hqBalUL: "The upper and lower halves are balanced: both outward and inward orientation are in use.",
  x_hqQT: ["The quadrant of the self: your own personality, identity, values and building a foundation.", "The quadrant of inner life: home, roots, feelings, creativity and daily life.", "The quadrant of relationships: partnerships, shared resources, learning and worldview.", "The quadrant of society: career, communities, ideals and public role."],
  x_hqQBal: "No quadrant stands out (none has at least 4 planets).",
  x_hqQHead: "Emphasised quadrant",
  x_alT: "Exact aspect orbs",
  x_alN: "The same aspect system as the aspect grid, just itemised. The orb is how far the actual separation is from the exact angle of the aspect. The maximum orb is the aspect’s base orb times the factors of the two points (wider for the luminaries, narrower for outer planets and calculated points). Sorted tightest first.",
  x_alTh: ["Points", "Aspect", "Exact angle", "Actual separation", "Orb", "Maximum orb", "Direction"],
  x_alNone: "No aspects were found with the chosen settings.",
  x_alCount: n => `${n} aspect${n === 1 ? "" : "s"}`,
  x_tip: (ex, sep, orb, max) => `Exact angle ${ex}° · actual separation ${sep} · orb ${orb} (maximum ${max})`,
  x_dgT: "Planetary dignities",
  x_dgN: "A symbolic classification from traditional astrology, not an astronomical measurement: it says nothing about a planet’s brightness, distance or actual strength. The seven classical planets are included; Uranus, Neptune, Pluto and the nodes are not part of the traditional system. The readings are general.",
  x_dgTh: ["Planet", "Sign", "Status", "Symbolic meaning"],
  x_dgRefT: "Traditional dignities (table)",
  x_dgRefTh: ["Planet", "Domicile", "Exaltation", "Detriment", "Fall"],
  x_dgSt: {dom: "Domicile", ex: "Exaltation", det: "Detriment", fall: "Fall", none: "No special status"},
  x_dgTx: {
    dom: "The planet is at home: its qualities come out naturally and on its own terms.",
    ex: "The planet is in a place of honour: it can express its best side.",
    det: "The planet is in the sign opposite its home: expression takes more adjusting and conscious work.",
    fall: "The planet is in the sign opposite its exaltation: its qualities tend to stay in the shadows or show up uncertainly.",
    none: "The sign is not the planet’s domicile, exaltation, detriment or fall (other traditional dignities, such as triplicity, were not assessed)."
  },
  x_dgBoth: "and",
  x_dgMoon: "The Moon moves over 12° a day, so without a birth time its sign is only approximate."
}
};

/* ------------------------------------------------------------------ helpers ------------------------------------------------------------------ */
// Traditional rulers per sign (Aries..Pisces) as body ids: 0 Sun, 1 Moon, 2 Mercury, 3 Venus, 4 Mars, 5 Jupiter, 6 Saturn.
const RULER = [4, 3, 2, 1, 0, 2, 3, 4, 5, 6, 6, 5];
// Essential dignities of the seven classical planets, as sign indices (0 = Aries).
const DIG = [
  {dom: [4], ex: 0, det: [10], fall: 6},        // Sun
  {dom: [3], ex: 1, det: [9], fall: 7},         // Moon
  {dom: [2, 5], ex: 5, det: [8, 11], fall: 11}, // Mercury
  {dom: [1, 6], ex: 11, det: [7, 0], fall: 5},  // Venus
  {dom: [0, 7], ex: 9, det: [6, 1], fall: 3},   // Mars
  {dom: [8, 11], ex: 3, det: [2, 5], fall: 9},  // Jupiter
  {dom: [9, 10], ex: 6, det: [3, 4], fall: 0}   // Saturn
];

const dm = x => { const m = Math.round(x * 60); return Math.floor(m / 60) + "°" + String(m % 60).padStart(2, "0") + "′"; };
const sec = (title, note) => {
  const d = document.createElement("div"); d.className = "sec";
  d.innerHTML = `<h2>${title}</h2>` + (note ? `<p class="note">${note}</p>` : "");
  return d;
};
const tbl = (head, rows, cls) => `<div class="tw"><table${cls ? ` class="${cls}"` : ""}><thead><tr>${head.map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
const signHtml = (T, l) => { const s = Math.floor(l / 30); return `<span class="sym">${SIGN[s]}</span> ${T.sign[s]}`; };
const planetHtml = (T, i) => `<span class="sym" style="color:var(--amber)">${PG[i]}</span> ${T.body[i]}`;
const ptName = (T, id) => id === "A" ? T.asc : id === "M" ? T.mc : `<span class="sym">${PG[id]}</span> ${T.body[id]}`;
const pId = v => /^\d+$/.test(String(v)) ? +v : v;

/* ------------------------------------------------------------------ 1. house cusps ------------------------------------------------------------------ */
function cuspsSection(res, T){
  const box = sec(T.x_cuT, T.x_cuN);
  if(!res.known){ box.insertAdjacentHTML("beforeend", `<p class="note">${T.x_needTime}</p>`); return box; }
  const cu = res.h.c, close = (a, b) => Math.abs(((a - b + 540) % 360) - 180) < 1e-6;
  const lab = c => close(c, res.h.asc) ? "ASC" : close(c, res.h.mc) ? "MC" : close(c, res.h.asc + 180) ? "DSC" : close(c, res.h.mc + 180) ? "IC" : "";
  const rows = cu.map((c, i) => `<tr><td>${i + 1}${lab(c) ? ` <span style="color:var(--amber)">${lab(c)}</span>` : ""}</td><td>${signHtml(T, c)}</td><td>${deg(c)}</td><td>${fmtN(c, 3)}°</td></tr>`);
  box.insertAdjacentHTML("beforeend", tbl(T.x_cuTh, rows)
    + `<p class="note">${T.hsn[res.sys]}.${res.h.polar ? " " + T.x_cuPolar : ""}</p>`);
  return box;
}

/* ------------------------------------------------------------------ 2. chart ruler ------------------------------------------------------------------ */
function rulerSection(res, T){
  const box = sec(T.x_ruT, T.x_ruN);
  if(!res.known){ box.insertAdjacentHTML("beforeend", `<p class="note">${T.x_needTime}</p>`); return box; }
  const as = Math.floor(res.h.asc / 30), r = RULER[as], rl = res.lon[r], rs = Math.floor(rl / 30), rh = houseOf(rl, res.h.c), rx = !!res.rx[r];
  const kv = [
    [T.x_ruRows[0], `${signHtml(T, res.h.asc)} ${deg(res.h.asc)}`],
    [T.x_ruRows[1], planetHtml(T, r)],
    [T.x_ruRows[2], `${signHtml(T, rl)} ${deg(rl)}`],
    [T.x_ruRows[3], T.hn(rh)],
    [T.x_ruRows[4], T.x_ruMove[rx ? 1 : 0]]
  ];
  box.insertAdjacentHTML("beforeend",
    `<div class="tw"><table class="kv"><tbody>${kv.map(x => `<tr><th>${x[0]}</th><td>${x[1]}</td></tr>`).join("")}</tbody></table></div>`
    + `<div class="q"><p>${T.x_ruI(T.sign[as], T.body[r])}</p>`
    + `<p><strong>${T.x_ruSign(T.body[r], T.sign[rs])}:</strong> ${psText(r, rs)}</p>`
    + `<p><strong>${T.hn(rh)}:</strong> ${housePlanet(r, rh)}</p>`
    + (rx ? `<p>${T.x_ruRx}</p>` : "") + `</div>`);
  return box;
}

/* ------------------------------------------------------------------ 3. lunar phase ------------------------------------------------------------------ */
// Phase angle and name from the ecliptic longitudes of the Sun and the Moon (res.lon[0], res.lon[1]).
// Illuminated fraction of the disc: Astronomy Engine's value for the same instant (it includes the Moon's ecliptic latitude and the
// Sun and Moon distances); if that is unavailable, (1 - cos(latitude) * cos(longitude difference)) / 2 is used instead.
function phaseInfo(res){
  const el = nm(res.lon[1] - res.lon[0]);
  let k = null;
  try{
    const AE = Astronomy, date = new Date((res.jd - 2440587.5) * 864e5);
    k = AE.Illumination(AE.Body.Moon, date).phase_fraction;
    if(!isFinite(k)) k = null;
    if(k === null){ const beta = AE.Ecliptic(AE.GeoMoon(date)).elat; k = (1 - Math.cos((isFinite(beta) ? beta : 0) * R) * Math.cos(el * R)) / 2; }
  }catch(e){ k = (1 - Math.cos(el * R)) / 2; }
  k = Math.min(1, Math.max(0, k));
  return {el, k, idx: Math.floor(nm(el + 22.5) / 45) % 8, dir: el > 0 && el < 180 ? 0 : el > 180 ? 1 : 2};
}
function moonIcon(p){
  const r = 24, rx = r * Math.abs(1 - 2 * p.k), waxing = p.dir === 0, gibbous = p.k > 0.5;
  let lit = "";
  if(p.k > 0.9995) lit = `<circle cx="0" cy="0" r="${r}" fill="#e6dcef"/>`;
  else if(p.k > 0.0005){
    const outer = waxing ? 1 : 0, inner = (waxing === gibbous) ? 1 : 0;
    lit = `<path d="M0,${-r}A${r},${r} 0 0 ${outer} 0,${r}A${rx.toFixed(2)},${r} 0 0 ${inner} 0,${-r}Z" fill="#e6dcef"/>`;
  }
  return `<svg viewBox="-28 -28 56 56" width="56" height="56" role="img" aria-hidden="true" style="flex:none"><circle cx="0" cy="0" r="${r}" fill="#1a1029" stroke="#6a4f9a" stroke-width="1.2"/>${lit}</svg>`;
}
function phaseSection(res, T){
  const box = sec(T.x_phT, T.x_phN), p = phaseInfo(res);
  const kv = [
    [T.x_phRows[0], `<strong>${T.x_phNames[p.idx]}</strong>`],
    [T.x_phRows[1], `${dm(p.el)}`],
    [T.x_phRows[2], fmtN(p.k * 100, 1) + " %"],
    [T.x_phRows[3], T.x_phDir[p.dir]]
  ];
  box.insertAdjacentHTML("beforeend",
    `<div class="moonrow">${moonIcon(p)}<div class="tw"><table class="kv"><tbody>${kv.map(x => `<tr><th>${x[0]}</th><td>${x[1]}</td></tr>`).join("")}</tbody></table></div></div>`
    + `<div class="q"><p>${T.x_phTxt[p.idx]}</p>${res.known ? "" : `<p>${T.moonN}</p>`}</div>`);
  return box;
}

/* ------------------------------------------------------------------ 4. hemispheres and quadrants ------------------------------------------------------------------ */
// Classifies a longitude by the axes: below = [ASC, DSC), east = [MC, IC) in the direction of increasing longitude.
function hemiOf(l, asc, mc){
  const below = nm(l - asc) < 180, east = nm(l - mc) < 180;
  return {east, below, q: below ? (east ? 0 : 1) : (east ? 3 : 2)};
}
function hemiSection(res, T){
  const box = sec(T.x_hqT, T.x_hqN);
  if(!res.known){ box.insertAdjacentHTML("beforeend", `<p class="note">${T.x_needTime}</p>`); return box; }
  const half = [[], [], [], []], quad = [[], [], [], []];   // east, west, upper, lower
  for(let i = 0; i < 10; i++){
    const g = hemiOf(res.lon[i], res.h.asc, res.h.mc);
    (g.east ? half[0] : half[1]).push(i);
    (g.below ? half[3] : half[2]).push(i);
    quad[g.q].push(i);
  }
  const cell = a => a.length ? a.map(i => `<span class="sym" title="${T.body[i]}">${PG[i]}</span>`).join(" ") : "–";
  const rows = [];
  half.forEach((a, i) => rows.push(`<tr><td>${T.x_hqHalf[i]}</td><td class="sym">${cell(a)}</td><td class="tot">${a.length}</td></tr>`));
  quad.forEach((a, i) => rows.push(`<tr><td>${T.x_hqQ[i]}</td><td class="sym">${cell(a)}</td><td class="tot">${a.length}</td></tr>`));
  // Short symbolic reading.
  const pair = (a, b, ta, tb, bal) => {
    if(a >= 7) return ta; if(b >= 7) return tb;
    if(a === 6) return `${T.x_hqSlight}: ${ta.charAt(0).toLowerCase() + ta.slice(1)}`;
    if(b === 6) return `${T.x_hqSlight}: ${tb.charAt(0).toLowerCase() + tb.slice(1)}`;
    return bal;
  };
  const txt = [pair(half[0].length, half[1].length, T.x_hqE, T.x_hqW, T.x_hqBalEW), pair(half[2].length, half[3].length, T.x_hqU, T.x_hqL, T.x_hqBalUL)];
  const mx = Math.max(...quad.map(a => a.length));
  if(mx >= 4) quad.forEach((a, i) => { if(a.length === mx) txt.push(`<strong>${T.x_hqQHead}: ${T.x_hqQ[i].replace(/ \(.*/, "")}.</strong> ${T.x_hqQT[i]}`); });
  else txt.push(T.x_hqQBal);
  box.insertAdjacentHTML("beforeend", tbl(T.x_hqTh, rows, "dist hq") + `<div class="q">${txt.map(x => `<p>${x}</p>`).join("")}</div>`);
  return box;
}

/* ------------------------------------------------------------------ 5. exact aspect orbs ------------------------------------------------------------------ */
// Detail of one aspect, using the same rule as the aspect grid (aspectRes, ASPT and the per-body orb factors).
function aspectDetail(res, ia, ib){
  const f = aspectRes(res, ia, ib, res.asp === "major");
  if(!f) return null;
  const a = lonOf(res, ia), b = lonOf(res, ib);
  let d = Math.abs(a - b) % 360; if(d > 180) d = 360 - d;
  return {ai: f.ai, exact: ASPT[f.ai][0], sep: d, off: f.off, max: ASPT[f.ai][1] * (bfOf(ia) + bfOf(ib)) / 2, ap: f.ap};
}
function aspectSection(res, T){
  const ids = chartPoints(res), list = [];
  for(let i = 1; i < ids.length; i++) for(let j = 0; j < i; j++){
    const f = aspectDetail(res, ids[i], ids[j]);
    if(f) list.push({a: ids[j], b: ids[i], f});
  }
  list.sort((x, y) => x.f.off - y.f.off);
  const d = document.createElement("details"); d.className = "guide";
  const rows = list.map(({a, b, f}) => `<tr><td>${ptName(T, a)} – ${ptName(T, b)}</td>`
    + `<td><span class="sym" style="color:${ASPT[f.ai][2]}">${ASPT[f.ai][3]}</span> ${T.an[f.ai]}</td>`
    + `<td>${f.exact}°</td><td>${dm(f.sep)}</td><td>${dm(f.off)}</td><td>${dm(f.max)}</td>`
    + `<td>${f.ap === 1 ? T.apl : f.ap === 0 ? T.sep : "–"}</td></tr>`);
  d.innerHTML = `<summary>${T.x_alT} (${T.x_alCount(list.length)})</summary><p class="note">${T.x_alN}</p>`
    + (list.length ? tbl(T.x_alTh, rows, "xt") : `<p class="note">${T.x_alNone}</p>`);
  return d;
}
// One extra line for the existing aspect tooltips.
function aspectTip(res, a, b){
  const f = aspectDetail(res, pId(a), pId(b)); if(!f) return "";
  return `<p class="dim">${L[lang].x_tip(f.exact, dm(f.sep), dm(f.off), dm(f.max))}</p>`;
}

/* ------------------------------------------------------------------ 6. dignities ------------------------------------------------------------------ */
function dignitiesOf(i, s){
  const g = DIG[i], out = [];
  if(g.dom.includes(s)) out.push("dom");
  if(g.ex === s) out.push("ex");
  if(g.det.includes(s)) out.push("det");
  if(g.fall === s) out.push("fall");
  return out.length ? out : ["none"];
}
function dignitySection(res, T){
  const box = sec(T.x_dgT, T.x_dgN), pos = {dom: 1, ex: 1, det: -1, fall: -1, none: 0};
  const rows = [];
  for(let i = 0; i < 7; i++){
    const s = Math.floor(res.lon[i] / 30), st = dignitiesOf(i, s);
    const col = st.some(k => pos[k] < 0) ? "#ff8fb3" : st.some(k => pos[k] > 0) ? "var(--moss)" : "var(--dim)";
    rows.push(`<tr><td>${planetHtml(T, i)}${res.rx[i] ? " ℞" : ""}</td><td>${signHtml(T, res.lon[i])}</td>`
      + `<td style="color:${col}">${st.map(k => T.x_dgSt[k]).join(` ${T.x_dgBoth} `)}</td><td>${st.map(k => T.x_dgTx[k]).join(" ")}</td></tr>`);
  }
  const ref = DIG.map((g, i) => `<tr><td>${planetHtml(T, i)}</td><td class="sym">${g.dom.map(s => SIGN[s]).join(" ")}</td><td class="sym">${SIGN[g.ex]}</td><td class="sym">${g.det.map(s => SIGN[s]).join(" ")}</td><td class="sym">${SIGN[g.fall]}</td></tr>`);
  box.insertAdjacentHTML("beforeend", tbl(T.x_dgTh, rows, "xt dg") + (res.known ? "" : `<p class="note">${T.x_dgMoon}</p>`));
  const d = document.createElement("details"); d.className = "guide";
  d.innerHTML = `<summary>${T.x_dgRefT}</summary>` + tbl(T.x_dgRefTh, ref, "dist");
  box.appendChild(d);
  return box;
}

/* ------------------------------------------------------------------ mounting ------------------------------------------------------------------ */
// slot "pos": after the position table; "asp": after the aspect grid; "dist": after the element/modality table.
function mount(box, res, T, slot){
  const parts = slot === "pos" ? [cuspsSection, rulerSection, dignitySection, phaseSection]
    : slot === "asp" ? [aspectSection]
    : slot === "dist" ? [hemiSection] : [];
  parts.forEach(fn => { try{ box.appendChild(fn(res, T)); }catch(e){ if(window.console) console.error("extras:", fn.name, e); } });
}

window.EXTRAS = {mount, aspectTip, aspectDetail, phaseInfo, hemiOf, dignitiesOf, RULER, DIG};

// Styles for the new sections only (appended, so the existing stylesheet is untouched).
const css = document.createElement("style");
css.textContent = `
.kv{min-width:0;width:auto}
.kv th{font-style:normal;white-space:nowrap;padding-right:18px}
.moonrow{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}
.moonrow .tw{flex:1 1 280px;min-width:0}
table.hq td:nth-child(2){text-align:left}
table.xt{min-width:520px}
table.dg{min-width:420px}
@media(max-width:700px){table.xt{min-width:560px}table.dg{min-width:0}.kv th{white-space:normal}}
`;
document.head.appendChild(css);
})();
