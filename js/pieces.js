/* Vitrine — the collection.
 *
 * Each piece is one of three kinds:
 *   note     an idea to chew on, written out
 *   passage  a short quotation from the public domain
 *   plate    a figure drawn live by js/plates.js
 *
 * Fields:
 *   lead   what appears large, under the glass
 *   label  the wall label: field/attribution, and a date
 *   note   the longer text revealed when you click through
 *   link   somewhere to go next
 *   tint   the colour the ambient ground takes on for this piece
 *
 * To add your own: copy any object below, change the words, save,
 * and reload the extension. Nothing else needs to change.
 */

const TINT = {
  verdigris: '#4E7C6E',
  oxblood:   '#8A3B36',
  indigo:    '#3C4A7A',
  ochre:     '#A07B32',
  moss:      '#5F6B3A',
  violet:    '#6A5B84',
  teal:      '#2F6B78',
  rust:      '#9A5A2C'
};

const PIECES = [

  /* ── Notes ────────────────────────────────────────────────── */

  {
    kind: 'note',
    lead: 'An octopus keeps two thirds of its neurons in its arms. Each arm tastes what it touches and can work a problem out on its own, which means the animal is less a brain with limbs than a committee that has agreed, for now, to travel together.',
    label: { field: 'Zoology · Cephalopoda', date: '' },
    note: 'A severed octopus arm will still reach, grip, and pass food toward where a mouth used to be. In the intact animal the central brain seems to issue something closer to intent than instruction — go there, get that — and leaves the arm to work out the geometry. Nobody has settled what it is like to be distributed in this way, or whether the animal experiences its arms as parts of itself at all.',
    link: { text: 'Cephalopod intelligence', url: 'https://en.wikipedia.org/wiki/Cephalopod_intelligence' },
    tint: TINT.violet
  },
  {
    kind: 'note',
    lead: 'Water is not pumped up a tree. It is pulled. The column inside a redwood is under tension, held together by nothing but the stickiness of water to itself, and it is technically in a state that ought to have snapped long ago.',
    label: { field: 'Botany · Hydraulics', date: '' },
    note: 'Evaporation at the leaf tugs on a continuous thread of water running all the way to the roots. The pressure in that thread is negative — below vacuum — and the water is metastable, primed to flash into vapour. Occasionally it does, with an audible click, and that segment of the plumbing is lost for good. A tall tree is a structure that spends its whole life quietly not shattering.',
    link: { text: 'Cohesion–tension theory', url: 'https://en.wikipedia.org/wiki/Transpirational_pull' },
    tint: TINT.moss
  },
  {
    kind: 'note',
    lead: 'Cologne Cathedral was begun in 1248 and finished in 1880, from the original medieval drawings, which had survived on parchment for six hundred years. The men who laid the foundation knew they would not see a roof.',
    label: { field: 'Architecture · Gothic', date: '1248–1880' },
    note: 'Work stopped around 1560 with the nave unbuilt and a wooden crane left standing on the south tower — it stayed there for three centuries and became the symbol of the city. When the plans for the façade turned up again in the 1810s, the nineteenth century finished the building more or less as the thirteenth had specified. It is worth sitting with the kind of confidence that lets you draw something you will never see.',
    link: { text: 'Cologne Cathedral', url: 'https://en.wikipedia.org/wiki/Cologne_Cathedral' },
    tint: TINT.ochre
  },
  {
    kind: 'note',
    lead: 'For most of a thousand years the only true blue came from one valley in Afghanistan. Ground lapis cost more than gold by weight, which is why, in painting after painting, it was spent on the Virgin and on almost nothing else.',
    label: { field: 'Pigment · Ultramarine', date: 'c. 600–1826' },
    note: 'The name means simply "from beyond the sea." Contracts of the period specify the grade of ultramarine the way they specify gold leaf, because the patron was buying the material as much as the image. Cheaper blues existed — azurite went green over time, smalt faded — so a painter deciding where to put the real blue was deciding what mattered. In 1826 a French chemist synthesised it for a prize, and the most expensive colour in Europe became the cheapest.',
    link: { text: 'Ultramarine', url: 'https://en.wikipedia.org/wiki/Ultramarine' },
    tint: TINT.indigo
  },
  {
    kind: 'note',
    lead: 'Japanese has a word, 間 (ma), for the interval — the gap between two things that gives them their shape. It is not absence. A room, a pause in speech, and the space between two notes are all the same word.',
    label: { field: 'Language · Japanese', date: '' },
    note: 'The character shows a moon seen through a gate: the opening is the point. In Noh theatre the ma is where the meaning sits; in a rock garden it is the raked gravel, not the rocks. Western design tends to call this negative space, which frames it as leftover. Ma frames it as the thing itself, and everything else as the walls that make it possible.',
    link: { text: 'Ma (negative space)', url: 'https://en.wikipedia.org/wiki/Ma_(negative_space)' },
    tint: TINT.teal
  },
  {
    kind: 'note',
    lead: 'Roman harbour concrete has been sitting in seawater for two thousand years and is stronger now than when it was poured. Modern marine concrete is engineered to survive fifty years. The Romans got it wrong in a way that turned out to be right.',
    label: { field: 'Materials · Concrete', date: 'c. 30 BCE' },
    note: 'They mixed volcanic ash from the Bay of Naples with lime and dropped it into the sea. Seawater then slowly dissolves parts of the mix and grows crystals of a rare mineral, aluminous tobermorite, through the cracks — the material heals itself using the thing that should be destroying it. Portland cement, by contrast, is designed to be inert, so when it cracks it simply stays cracked and the steel inside begins to rust.',
    link: { text: 'Roman concrete', url: 'https://en.wikipedia.org/wiki/Roman_concrete' },
    tint: TINT.rust
  },
  {
    kind: 'note',
    lead: 'In Tuyuca, spoken in the Amazon, you cannot simply say that a man arrived. The verb must carry how you know: whether you saw it, heard it, inferred it from the tracks, or were told. There is no grammatical way to be vague about your evidence.',
    label: { field: 'Linguistics · Evidentiality', date: '' },
    note: 'Roughly a quarter of the world\'s languages mark evidentiality somewhere in the grammar, and a few, like Tuyuca, make it obligatory on every finite verb. Speakers report that it is not felt as a burden, any more than English speakers feel burdened by having to mark tense. What it does do is make one class of dishonesty — the unattributed claim — grammatically awkward rather than merely rude.',
    link: { text: 'Evidentiality', url: 'https://en.wikipedia.org/wiki/Evidentiality' },
    tint: TINT.moss
  },
  {
    kind: 'note',
    lead: 'A whale that dies in deep water feeds a community for decades. First the scavengers, then the worms in the sediment, then bacteria living off the sulphur in the bones — a full ecological succession, run on one animal, in the dark.',
    label: { field: 'Ecology · Whale fall', date: '' },
    note: 'The final stage can last fifty years or more, as chemosynthetic bacteria break down lipids trapped in the skeleton and support a community that resembles the one around a hydrothermal vent. Several species are known from whale falls and nowhere else. Since industrial whaling removed most large whales from the ocean, these habitats have become correspondingly rare, and some of those species may have quietly gone with them.',
    link: { text: 'Whale fall', url: 'https://en.wikipedia.org/wiki/Whale_fall' },
    tint: TINT.teal
  },
  {
    kind: 'note',
    lead: 'The flying buttress is not decoration. It is the moment builders realised the forces holding a roof up could be moved outside the building, which meant the wall no longer had to be a wall, and could become glass.',
    label: { field: 'Architecture · Structure', date: 'c. 1180' },
    note: 'A stone vault pushes outward as well as down. In a Romanesque church that thrust is absorbed by making the walls enormously thick, so the windows stay small and the interior stays dark. The Gothic solution catches the thrust on an arm of masonry that leaps clear of the wall to a pier outside. Everything that follows — the height, the light, the sense that the building is barely there — is a consequence of relocating a force by a few metres.',
    link: { text: 'Flying buttress', url: 'https://en.wikipedia.org/wiki/Flying_buttress' },
    tint: TINT.ochre
  },
  {
    kind: 'note',
    lead: 'Anna Atkins made the first book illustrated with photographs in 1843 — cyanotypes of British seaweed, laid straight onto the paper and printed by sunlight. There is no camera involved. The algae drew themselves.',
    label: { field: 'Photography · Cyanotype', date: '1843' },
    note: 'She hand-wrote every caption on the plates because printed text alongside a photogram was not yet a solved problem. The blue is Prussian blue, produced when iron salts on the paper are reduced by ultraviolet light; the parts the specimen covered stay white. Roughly a dozen copies survive. It predates the first commercially photographically-illustrated book by several years, and for a long time she was catalogued as "A. Atkins," assumed male.',
    link: { text: 'Anna Atkins', url: 'https://en.wikipedia.org/wiki/Anna_Atkins' },
    tint: TINT.indigo
  },
  {
    kind: 'note',
    lead: 'No piano is in tune. Twelve-tone equal temperament divides the octave into twelve equal steps, and every interval except the octave is then slightly wrong on purpose, so that all of them can be equally slightly wrong in every key.',
    label: { field: 'Acoustics · Temperament', date: '' },
    note: 'Stack twelve perfect fifths and you overshoot seven octaves by about a quarter of a semitone — the Pythagorean comma. Earlier tunings dealt with this by making a few keys beautiful and one interval, the wolf fifth, unusable; you tuned the instrument for the piece you meant to play. Equal temperament spreads the error thinly everywhere, which is what makes modulation to any key possible, and why a barbershop quartet singing without accompaniment will drift away from the piano and sound better for it.',
    link: { text: 'Equal temperament', url: 'https://en.wikipedia.org/wiki/Equal_temperament' },
    tint: TINT.violet
  },
  {
    kind: 'note',
    lead: 'Blue is the last colour languages name. Across unrelated cultures the order is near-identical: dark and light, then red, then green and yellow, then blue. Homer had a wine-dark sea and no word for the sky.',
    label: { field: 'Language · Colour terms', date: '1969' },
    note: 'Berlin and Kay found the sequence in the 1960s and it has held up in broad outline since, with refinements. The usual explanation is not that people could not see blue but that they had little reason to name it: blue is rare in pigment, rare in dyeable material, and the sky is not an object you need to pick out from other objects. Where a culture had a blue dye, it tended to have a blue word.',
    link: { text: 'Basic Color Terms', url: 'https://en.wikipedia.org/wiki/Basic_Color_Terms:_Their_Universality_and_Evolution' },
    tint: TINT.indigo
  },
  {
    kind: 'note',
    lead: 'The shrine at Ise has been torn down and rebuilt on the adjacent plot every twenty years since roughly 690. The building is 1,300 years old and also thirteen years old. Nobody in Japan finds this a contradiction.',
    label: { field: 'Architecture · Ise Jingū', date: 'c. 690–' },
    note: 'Two identical sites sit side by side; the new shrine rises on the empty one while the old still stands, and the old is then dismantled and its timber distributed to other shrines. The point is partly the continuity of the craft — carpenters learn the joinery by doing it, once, in their working life — and partly a different theory of what a building is. The West tends to locate authenticity in the original material. Ise locates it in the pattern and the act of remaking.',
    link: { text: 'Ise Grand Shrine', url: 'https://en.wikipedia.org/wiki/Ise_Grand_Shrine' },
    tint: TINT.moss
  },
  {
    kind: 'note',
    lead: 'In 1788 James Hutton stood at Siccar Point and looked at two sets of rock meeting at an angle — one laid down, tilted on end, worn flat, then buried under another. The gap between them had no visible bottom. He had found deep time.',
    label: { field: 'Geology · Unconformity', date: '1788' },
    note: 'His companion John Playfair wrote afterwards that the mind grew giddy looking so far into the abyss. The junction implies a whole cycle of deposition, upheaval, and erosion completed before the upper layer even began — hundreds of millions of years, at a moment when the accepted age of the Earth was a few thousand. Everything about the modern picture of the planet, and eventually of life, needed that gap to exist first.',
    link: { text: 'Siccar Point', url: 'https://en.wikipedia.org/wiki/Siccar_Point' },
    tint: TINT.rust
  },
  {
    kind: 'note',
    lead: 'A slime mould with no brain, given oat flakes arranged like the towns around Tokyo, grew a network of tubes that closely resembled the actual rail system — built by engineers, over decades, at great expense.',
    label: { field: 'Biology · Physarum', date: '2010' },
    note: 'Physarum polycephalum first floods an area indiscriminately, then thickens the tubes that carry the most flow and lets the rest wither. The result balances total length, redundancy, and transport efficiency in about the way a planner would, without any planner. It is a useful corrective to the assumption that good design requires a designer, and also to the assumption that a nervous system is required for anything interesting to happen.',
    link: { text: 'Physarum polycephalum', url: 'https://en.wikipedia.org/wiki/Physarum_polycephalum' },
    tint: TINT.ochre
  },
  {
    kind: 'note',
    lead: 'The bright red of European armies, of cardinals\' robes, of the Mexican tribute rolls, came from an insect the size of a grain of rice. Spain kept the source secret for two hundred years and grew rich on it.',
    label: { field: 'Pigment · Cochineal', date: 'c. 1520' },
    note: 'Cochineal live on prickly pear and produce carminic acid, presumably to taste terrible to ants. Dried and crushed, they give a red ten times stronger than the European alternative, and after silver it became the most valuable export from the New World. European naturalists argued for decades over whether the imported grains were a seed or an animal. It is still in food and cosmetics, listed as carmine or E120.',
    link: { text: 'Cochineal', url: 'https://en.wikipedia.org/wiki/Cochineal' },
    tint: TINT.oxblood
  },
  {
    kind: 'note',
    lead: 'Most of the living space on Earth is deep ocean, and most of the animals in it make their own light. Measured by volume of habitat, bioluminescence is the norm and our sunlit, non-glowing world is the strange exception.',
    label: { field: 'Ecology · Bioluminescence', date: '' },
    note: 'Estimates put three quarters of midwater animals in the light-producing category. It is used for almost everything: luring, warning, mating, and counter-illumination, where an animal lights its own underside to erase its silhouette against the faint glow from above. The same chemistry has been invented independently dozens of times, which is a strong hint about how useful it is down there.',
    link: { text: 'Bioluminescence', url: 'https://en.wikipedia.org/wiki/Bioluminescence' },
    tint: TINT.teal
  },
  {
    kind: 'note',
    lead: 'A device recovered from a Roman-era shipwreck turned out to be a geared analogue computer that predicted eclipses and tracked the irregular motion of the moon. Nothing of comparable complexity is known for another thousand years.',
    label: { field: 'Instruments · Antikythera', date: 'c. 150–100 BCE' },
    note: 'At least thirty bronze gears, one riding eccentrically on another to model the moon speeding up and slowing down through its orbit — a mechanical solution to a problem in astronomy that would not be described in writing for centuries. It carries a dial for the four-year cycle of the games, including Olympia. The unsettling part is not that someone built it but that it appears without ancestors and without descendants, which mostly means we have lost everything around it.',
    link: { text: 'Antikythera mechanism', url: 'https://en.wikipedia.org/wiki/Antikythera_mechanism' },
    tint: TINT.verdigris
  },

  /* ── Passages ─────────────────────────────────────────────── */

  {
    kind: 'passage',
    lead: 'No one steps into the same river twice.',
    label: { field: 'Heraclitus · Fragments', date: 'c. 500 BCE' },
    note: 'The line survives only because later writers quoted it while arguing with him. The usual reading is that the water has moved on; the harder reading, which Heraclitus seems to have meant, is that the person has too. What makes a river a river is not any of its parts but the pattern the parts pass through — which is also, he thought, what makes a person a person.',
    link: { text: 'Heraclitus', url: 'https://en.wikipedia.org/wiki/Heraclitus' },
    tint: TINT.teal
  },
  {
    kind: 'passage',
    lead: 'The universe is change; our life is what our thoughts make it.',
    label: { field: 'Marcus Aurelius · Meditations', date: 'c. 170 CE' },
    note: 'Written in Greek, in camp, on campaign, by a man who had no expectation that anyone would read it — the title given to it later means roughly "to himself." Much of it is repetitive, and that is the point: it is a person talking himself back into a position he keeps sliding out of. The consolation is not that the doctrine is airtight but that the most powerful man alive had to keep reminding himself of it.',
    link: { text: 'Meditations', url: 'https://en.wikipedia.org/wiki/Meditations' },
    tint: TINT.rust
  },
  {
    kind: 'passage',
    lead: 'When I play with my cat, who knows whether she is not amusing herself with me?',
    label: { field: 'Montaigne · Essays', date: '1580' },
    note: 'It appears inside a long defence of the claim that human reason is not obviously superior to animal reason, and it works because it is so ordinary. Montaigne is not making an argument about consciousness so much as noticing that he has been assuming he is the subject of the encounter. The Essays largely invented this move — thinking in public, in the first person, without resolving.',
    link: { text: 'Essays (Montaigne)', url: 'https://en.wikipedia.org/wiki/Essays_(Montaigne)' },
    tint: TINT.ochre
  },
  {
    kind: 'passage',
    lead: 'The eternal silence of these infinite spaces frightens me.',
    label: { field: 'Pascal · Pensées', date: 'c. 1660' },
    note: 'Pascal was a first-rate mathematician and physicist, and the fear is the fear of someone who has actually done the arithmetic on the new astronomy. The Pensées are fragments — notes for an unfinished defence of Christianity, found after his death and arranged by other people ever since. The sentence is usually quoted as despair, though in context it is the setup for an argument, not the conclusion.',
    link: { text: 'Pensées', url: 'https://en.wikipedia.org/wiki/Pens%C3%A9es' },
    tint: TINT.indigo
  },
  {
    kind: 'passage',
    lead: 'What then is time? If no one asks me, I know; if I wish to explain it, I do not know.',
    label: { field: 'Augustine · Confessions', date: 'c. 400 CE' },
    note: 'Book XI turns on the problem that the past no longer exists, the future does not yet, and the present has no duration — so what exactly is being measured when we measure time? Augustine\'s answer is that we measure something in the mind: the impression the passing thing leaves. It is a strikingly modern move, and philosophers of time still open with this passage sixteen centuries later.',
    link: { text: 'Confessions', url: 'https://en.wikipedia.org/wiki/Confessions_(Augustine)' },
    tint: TINT.violet
  },
  {
    kind: 'passage',
    lead: 'The limits of my language mean the limits of my world.',
    label: { field: 'Wittgenstein · Tractatus', date: '1922' },
    note: 'Written largely in the trenches and in an Italian prisoner-of-war camp. The Tractatus argues that language pictures facts, and that whatever cannot be said that way — ethics, aesthetics, the meaning of life — cannot be said at all, only shown. Wittgenstein thought he had finished philosophy and left it to teach primary school. He came back a decade later and spent the rest of his life dismantling the book.',
    link: { text: 'Tractatus Logico-Philosophicus', url: 'https://en.wikipedia.org/wiki/Tractatus_Logico-Philosophicus' },
    tint: TINT.violet
  },
  {
    kind: 'passage',
    lead: 'My experience is what I agree to attend to.',
    label: { field: 'William James · Principles of Psychology', date: '1890' },
    note: 'James is making an empirical point, not a motivational one: the sensory world is enormous and undifferentiated, and what reaches you as experience is only the part selection has let through. Millions of items are present to the senses and never enter experience at all, because they have no interest for you. He is also, characteristically, choosing his words so that the sentence sounds like advice.',
    link: { text: 'The Principles of Psychology', url: 'https://en.wikipedia.org/wiki/The_Principles_of_Psychology' },
    tint: TINT.moss
  },
  {
    kind: 'passage',
    lead: 'Well building hath three conditions: firmness, commodity, and delight.',
    label: { field: 'Wotton, after Vitruvius', date: '1624' },
    note: 'Henry Wotton\'s English rendering of Vitruvius — firmitas, utilitas, venustas. It has survived four hundred years mostly because of the third term. Nobody disputes that a building should stand up and be useful; the argument, then and now, is over whether delight is a requirement or a luxury, and Vitruvius put it in the same list as not falling down.',
    link: { text: 'De architectura', url: 'https://en.wikipedia.org/wiki/De_architectura' },
    tint: TINT.ochre
  },
  {
    kind: 'passage',
    lead: 'When we build, let us think that we build for ever.',
    label: { field: 'Ruskin · The Seven Lamps of Architecture', date: '1849' },
    note: 'Ruskin is arguing under the Lamp of Memory that a building belongs partly to the people who have not been born yet, and that we therefore have no right to restore it into something they cannot read. He hated restoration — thought it a lie told about the past — and preferred honest ruin. The Victorians restored everything anyway.',
    link: { text: 'The Seven Lamps of Architecture', url: 'https://en.wikipedia.org/wiki/The_Seven_Lamps_of_Architecture' },
    tint: TINT.rust
  },
  {
    kind: 'passage',
    lead: 'The Analytical Engine weaves algebraical patterns as the Jacquard loom weaves flowers and leaves.',
    label: { field: 'Ada Lovelace · Note A', date: '1843' },
    note: 'Lovelace was translating an Italian account of Babbage\'s unbuilt machine and appended notes more than twice as long as the original. The loom analogy is doing real work: she had grasped that a machine punching through cards was manipulating symbols, not numbers, and that the symbols need not stand for quantities at all. She speculates about composing music with it. Nothing like the machine was built for a century.',
    link: { text: 'Ada Lovelace', url: 'https://en.wikipedia.org/wiki/Ada_Lovelace' },
    tint: TINT.verdigris
  },
  {
    kind: 'passage',
    lead: 'The universe is wider than our views of it.',
    label: { field: 'Thoreau · Walden', date: '1854' },
    note: 'From the closing chapter, where Thoreau explains why he left the pond as deliberately as he went to it. Walden is usually read as nature writing and is really a book about attention and about how much of a life is spent servicing arrangements one never chose. He was, it should be said, about twenty minutes\' walk from town, and did his laundry there.',
    link: { text: 'Walden', url: 'https://en.wikipedia.org/wiki/Walden' },
    tint: TINT.moss
  },
  {
    kind: 'passage',
    lead: 'From so simple a beginning endless forms most beautiful and most wonderful have been, and are being, evolved.',
    label: { field: 'Darwin · On the Origin of Species', date: '1859' },
    note: 'The last line of the book, and the only place in the first edition where Darwin uses the word "evolved." He is standing at an entangled bank, listing the ordinary things on it — birds, insects, worms in the damp earth — and pointing out that all of it follows from laws he has just spent four hundred pages describing. The sentence is doing something careful: making the conclusion feel like a gain rather than a loss.',
    link: { text: 'On the Origin of Species', url: 'https://en.wikipedia.org/wiki/On_the_Origin_of_Species' },
    tint: TINT.moss
  },
  {
    kind: 'passage',
    lead: 'Thirty spokes meet at the hub, but it is the hole in the middle that makes the wheel useful.',
    label: { field: 'Tao Te Ching · Ch. 11', date: 'c. 400 BCE' },
    note: 'The chapter runs through three examples — a wheel, a clay pot, a room with doors and windows — and lands on the same point each time: what you make is the material, what you use is the void it encloses. It is a very old argument for designing the gap rather than the thing, and it sits close to the Japanese idea of ma.',
    link: { text: 'Tao Te Ching', url: 'https://en.wikipedia.org/wiki/Tao_Te_Ching' },
    tint: TINT.teal
  },
  {
    kind: 'passage',
    lead: 'It is not things that disturb us, but our opinions about things.',
    label: { field: 'Epictetus · Enchiridion', date: 'c. 125 CE' },
    note: 'Epictetus was born into slavery and lame, probably from an injury inflicted by an owner. He wrote nothing; the Enchiridion is a student\'s compilation of his lectures. The claim is stronger than it first sounds — not that you should feel differently, but that the feeling was never caused by the event in the first place, and so the leverage is in a different place than you thought.',
    link: { text: 'Enchiridion of Epictetus', url: 'https://en.wikipedia.org/wiki/Enchiridion_of_Epictetus' },
    tint: TINT.rust
  },
  {
    kind: 'passage',
    lead: 'Once I dreamt I was a butterfly, and did not know I was Zhuangzi.',
    label: { field: 'Zhuangzi · Ch. 2', date: 'c. 300 BCE' },
    note: 'He wakes, and cannot establish whether he is a man who dreamt he was a butterfly or a butterfly now dreaming it is a man. The passage is usually filed under scepticism about knowledge, but Zhuangzi\'s own gloss points elsewhere — he calls it the transformation of things, and seems more interested in the fact that the boundary moved at all than in which side is real.',
    link: { text: 'Zhuangzi', url: 'https://en.wikipedia.org/wiki/Zhuangzi_(book)' },
    tint: TINT.violet
  },
  {
    kind: 'passage',
    lead: 'Wonder is broken knowledge.',
    label: { field: 'Francis Bacon · The Advancement of Learning', date: '1605' },
    note: 'Bacon means it as a diagnosis: wonder is what a mind does when it has part of a pattern and not the rest, and the cure is to go and find the rest. He is generally impatient with awe as a resting place. Whether the broken state is worse than the mended one he does not say, and later readers have taken the line in exactly the opposite spirit.',
    link: { text: 'The Advancement of Learning', url: 'https://en.wikipedia.org/wiki/The_Advancement_of_Learning' },
    tint: TINT.ochre
  },

  /* ── Plates ───────────────────────────────────────────────── */

  {
    kind: 'plate',
    draw: 'phyllotaxis',
    lead: 'The Golden Angle',
    label: { field: 'Plate I · Drawn from 137.5°', date: '' },
    note: 'Each seed is placed one turn of 137.507° from the last. That angle is the one least well approximated by any simple fraction, so no seed ever lands directly behind another and the head packs without gaps or seams. The spiral arms you see are not built — nobody counts them — they fall out of the rule, and their number is always a pair of adjacent Fibonacci numbers. Change the angle by a tenth of a degree and the pattern collapses into spokes.',
    link: { text: 'Phyllotaxis', url: 'https://en.wikipedia.org/wiki/Phyllotaxis' },
    tint: TINT.ochre
  },
  {
    kind: 'plate',
    draw: 'chladni',
    lead: 'Nodal Figures',
    label: { field: 'Plate II · Standing waves on a plate', date: '1787' },
    note: 'Chladni scattered sand on a metal plate and drew a violin bow along its edge. The sand bounced away from everywhere that was moving and settled along the lines that stayed still. Each frequency has its own figure. Napoleon saw the demonstration, called it making sound visible, and put up prize money for anyone who could explain it mathematically — which took another few decades and was eventually done by Sophie Germain, who had to submit her early work under a man\'s name.',
    link: { text: 'Chladni figures', url: 'https://en.wikipedia.org/wiki/Ernst_Chladni' },
    tint: TINT.verdigris
  },
  {
    kind: 'plate',
    draw: 'rosette',
    lead: 'Retrograde',
    label: { field: 'Plate III · Venus, as seen from Earth', date: '' },
    note: 'Trace the line from Earth to Venus for eight years and it closes into a five-petalled rosette, because thirteen Venus years fit almost exactly into eight of ours. The bright loops at the centre are the close passes, and each one is a stretch where the planet appears to stop and go backwards. Explaining those loops was the central problem of astronomy for two thousand years, and the epicycles built to account for them were not stupid — they were an accurate description of the pattern, drawn from the wrong vantage point.',
    link: { text: 'Apparent retrograde motion', url: 'https://en.wikipedia.org/wiki/Apparent_retrograde_motion' },
    tint: TINT.indigo
  },
  {
    kind: 'plate',
    draw: 'strata',
    lead: 'Angular Unconformity',
    label: { field: 'Plate IV · After Siccar Point', date: '' },
    note: 'Two sets of beds meeting at an angle. The lower set was laid down flat, tilted on end, and worn away; then the sea returned and the upper set was laid down flat on the stump. Every stage takes an unhurried amount of time, and the surface between them — a single line in the rock — represents all of it. Geologists call that line a hiatus. It is the most information-dense feature in the outcrop and it is the part that looks like nothing.',
    link: { text: 'Unconformity', url: 'https://en.wikipedia.org/wiki/Unconformity' },
    tint: TINT.rust
  },
  {
    kind: 'plate',
    draw: 'vault',
    lead: 'The Square and the Dome',
    label: { field: 'Plate V · Pendentive geometry', date: 'c. 537' },
    note: 'A dome is round and a room is square, and for centuries that was an unsolved problem. The pendentive is the answer: take a dome larger than the room, slice it with four vertical planes, and the curved triangles left over carry the load down into the corners. Hagia Sophia is the first full-scale demonstration, and contemporaries described the dome as if suspended from heaven by a golden chain — which is what the solution looks like when you cannot see how it works.',
    link: { text: 'Pendentive', url: 'https://en.wikipedia.org/wiki/Pendentive' },
    tint: TINT.ochre
  },
  {
    kind: 'plate',
    draw: 'ramify',
    lead: 'Ramification',
    label: { field: 'Plate VI · A drainage basin', date: '' },
    note: 'River networks, lightning, lung airways, and the veins in a leaf converge on nearly the same geometry, because they are all solving one problem: move something between a point and a volume with the least total resistance. The branching ratios repeat at every scale, so a photograph of a delta and a photograph of a capillary bed are hard to tell apart without something for scale. The pattern is not inherited from anywhere. It is just what the cheapest answer looks like.',
    link: { text: 'Dendritic drainage', url: 'https://en.wikipedia.org/wiki/Drainage_system_(geomorphology)' },
    tint: TINT.teal
  }
];
