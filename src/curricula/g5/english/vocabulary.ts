import { bankTopic } from '../../../engine/bank';

const UNIT = 'vocab';

/* ---------------- Family and people ---------------- */
export const peopleFamily = bankTopic({
  id: 'people-family',
  unit: UNIT,
  title: 'Family and People',
  emoji: '👨‍👩‍👧',
  lesson: [
    { kind: 'text', text: '**Family – משפחה**\nmother, father, parents, sister, brother, grandmother, grandfather, aunt, uncle, cousin, baby' },
    { kind: 'example', text: 'My mother’s sister is my **aunt**. My aunt’s son is my **cousin**.' },
    { kind: 'text', text: '**Describing people – תיאור אנשים**\ntall / short, young / old, long hair / short hair, curly hair, blue eyes, brown eyes' },
    { kind: 'example', text: 'Dana is **tall**. She has **long curly** hair and **brown** eyes.' },
    { kind: 'text', text: '**Clothes – בגדים**\nshirt, T-shirt, dress, skirt, pants, jeans, coat, hat, shoes, socks' },
    { kind: 'tip', text: 'באנגלית התיאור בא **לפני** שם העצם: a **red** dress (שמלה אדומה), **long** hair (שיער ארוך).' },
  ],
  items: [
    { l: 1, q: 'My father’s mother is my ___.', a: 'grandmother', d: ['sister', 'aunt', 'cousin'], why: 'אמא של אבא היא **סבתא** – grandmother.' },
    { l: 1, q: 'What is the opposite of **tall**?', a: 'short', d: ['old', 'young', 'long'], why: 'tall = גבוה, short = נמוך. (short הוא גם "קצר", למשל short hair.)' },
    { l: 1, q: 'Which one is clothes?', a: 'a coat', d: ['a cousin', 'a kitchen', 'a lemon'], why: 'coat = מעיל. cousin = בן דוד, kitchen = מטבח, lemon = לימון.' },
    { l: 1, q: 'My mother and father are my ___.', a: 'parents', d: ['cousins', 'uncles', 'friends'], why: 'parents = הורים – אמא ואבא יחד.' },
    { l: 1, q: 'Write the missing word: My brother is a boy. My ___ is a girl.', text: ['sister'], why: 'sister = אחות. brother = אח.' },
    { l: 2, q: 'My mother’s brother is my ___.', a: 'uncle', d: ['aunt', 'cousin', 'grandfather'], why: 'אח של אמא הוא **דוד** – uncle. אחות של אמא היא **דודה** – aunt.' },
    { l: 2, q: 'Choose the correct sentence:', a: 'She has long black hair.', d: ['She has hair long black.', 'She has black long hairs.', 'She have long black hair.'], why: 'התיאורים באים לפני hair, ו־hair (שיער) לא מקבל s. עם she אומרים **has**.' },
    { l: 2, q: 'Match each word to its meaning:', match: [['dress', 'שמלה'], ['shoes', 'נעליים'], ['hat', 'כובע'], ['socks', 'גרביים']], why: 'dress – שמלה, shoes – נעליים, hat – כובע, socks – גרביים.' },
    { l: 2, tf: 'My aunt’s son is my cousin.', t: true, why: 'הבן של הדודה הוא בן דוד – cousin. (גם הבת של הדודה היא cousin.)' },
    { l: 3, q: 'Read: "Tom is ten. He is short and he has curly red hair. He is wearing a green T-shirt." Which is TRUE?', a: 'Tom has red hair.', d: ['Tom is tall.', 'Tom has straight hair.', 'Tom is wearing a red T-shirt.'], why: 'כתוב: curly red hair – שיער אדום ומתולתל. החולצה ירוקה (green), ותום נמוך (short).' },
    { l: 3, q: 'Which words describe a person’s **appearance** (how they look)?', multi: ['tall', 'blue eyes', 'curly hair'], d: ['kitchen', 'Tuesday'], why: 'tall, blue eyes, curly hair מתארים איך מישהו נראה. kitchen הוא מטבח ו־Tuesday הוא יום שלישי.' },
    { l: 3, q: 'Grandma is my mother’s mother. Her husband is my ___.', a: 'grandfather', d: ['uncle', 'father', 'brother'], why: 'בעלה של סבתא הוא **סבא** – grandfather.' },
  ],
});

/* ---------------- Daily life and time ---------------- */
export const dailyRoutine = bankTopic({
  id: 'daily-routine',
  unit: UNIT,
  title: 'Daily Life and Time',
  emoji: '⏰',
  lesson: [
    { kind: 'text', text: '**Days of the week:** Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday' },
    { kind: 'text', text: '**Routine – סדר יום:** get up, wash my face, get dressed, eat breakfast, go to school, do homework, have dinner, go to bed' },
    { kind: 'example', text: 'I **get up** at 7:00. I **go to school** at 8:00.' },
    { kind: 'text', text: '**Time – שעה:**\n7:00 = seven o’clock\n7:30 = half past seven\n7:15 = a quarter past seven' },
    { kind: 'text', text: '**School subjects:** math, English, science, art, music, sports (P.E.)' },
    { kind: 'tip', text: 'ימים בשבוע וחודשים באנגלית תמיד מתחילים ב**אות גדולה**: Monday, May.' },
  ],
  items: [
    { l: 1, q: 'Which day comes after Sunday?', a: 'Monday', d: ['Saturday', 'Friday', 'Wednesday'], why: 'Sunday (ראשון) ← Monday (שני).' },
    { l: 1, q: 'In the morning I eat ___.', a: 'breakfast', d: ['dinner', 'homework', 'a bed'], why: 'breakfast = ארוחת בוקר. dinner = ארוחת ערב.' },
    { l: 1, q: 'What time is 9:00?', a: 'nine o’clock', d: ['half past nine', 'nine thirty-five', 'a quarter past nine'], why: 'שעה עגולה: nine o’clock – תשע בדיוק.' },
    { l: 1, tf: 'Saturday is a day of the week.', t: true, why: 'Saturday = יום שבת.' },
    { l: 1, q: 'Write the missing day: Monday, Tuesday, ___, Thursday', text: ['Wednesday'], why: 'הסדר: Monday, Tuesday, **Wednesday**, Thursday.' },
    { l: 2, q: 'Put the routine in order (morning to night):', order: ['get up', 'eat breakfast', 'go to school', 'do homework', 'go to bed'], why: 'קמים, אוכלים ארוחת בוקר, הולכים לבית הספר, מכינים שיעורי בית והולכים לישון.' },
    { l: 2, q: 'What time is 4:30?', a: 'half past four', d: ['half past three', 'four o’clock', 'a quarter past four'], why: 'half past = וחצי. 4:30 = half past four.' },
    { l: 2, q: 'Match the school subject to what you do:', match: [['math', 'count and add numbers'], ['art', 'draw and paint'], ['music', 'sing and play'], ['science', 'do experiments']], why: 'math – חשבון, art – אמנות, music – מוזיקה, science – מדעים.' },
    { l: 2, q: 'Which day comes before Friday?', a: 'Thursday', d: ['Saturday', 'Tuesday', 'Sunday'], why: 'Thursday (חמישי) בא לפני Friday (שישי).' },
    { l: 3, q: 'Read the timetable:\n**Sunday:** math 8:00, English 9:00, art 10:00\nWhen is the English lesson?', a: 'at nine o’clock', d: ['at eight o’clock', 'at ten o’clock', 'on Monday'], why: 'בשורה של Sunday כתוב English 9:00 – nine o’clock.' },
    { l: 3, q: 'A note on the door says: "Gone to the park. Back at 5:15." When will they be back?', a: 'at a quarter past five', d: ['at half past five', 'at five o’clock', 'at a quarter past six'], why: '5:15 = a quarter past five – חמש ורבע.' },
    { l: 3, q: 'Which words are things we do every day (routine)?', multi: ['brush my teeth', 'get dressed', 'have dinner'], d: ['cousin', 'Wednesday'], why: 'brush my teeth, get dressed, have dinner הן פעולות. cousin הוא בן דוד, ו־Wednesday הוא יום רביעי.' },
  ],
});

/* ---------------- Places, weather and things ---------------- */
export const placesThings = bankTopic({
  id: 'places-things',
  unit: UNIT,
  title: 'Places, Weather and Things',
  emoji: '🏙️',
  lesson: [
    { kind: 'text', text: '**Places – מקומות:** school, park, library, hospital, supermarket, beach, zoo, restaurant, bus station' },
    { kind: 'text', text: '**Weather – מזג אוויר:** sunny, rainy, cloudy, windy, hot, cold\n**Seasons:** spring, summer, autumn (fall), winter' },
    { kind: 'example', text: 'It is **sunny** and **hot** in the summer.' },
    { kind: 'text', text: '**Where is it? – מילות מקום:** in, on, under, next to, behind, between' },
    { kind: 'example', text: 'The cat is **under** the table. The book is **on** the bed.' },
    { kind: 'tip', text: 'in = בתוך, on = על, under = מתחת, next to = ליד, behind = מאחורי, between = בין.' },
  ],
  items: [
    { l: 1, q: 'Where do you borrow books?', a: 'at the library', d: ['at the zoo', 'at the beach', 'at the hospital'], why: 'library = ספרייה. שם שואלים ספרים.' },
    { l: 1, q: 'It is raining. The weather is ___.', a: 'rainy', d: ['sunny', 'hot', 'windy'], why: 'rain = גשם, rainy = גשום.' },
    { l: 1, q: 'The ball is **under** the chair. "under" means:', a: 'מתחת', d: ['על', 'ליד', 'בתוך'], why: 'under = מתחת. on = על, next to = ליד, in = בתוך.' },
    { l: 1, tf: 'Winter is a season.', t: true, why: 'winter = חורף. העונות: spring, summer, autumn, winter.' },
    { l: 2, q: 'Where can you see lions and monkeys?', a: 'at the zoo', d: ['at the supermarket', 'at the library', 'at the bus station'], why: 'zoo = גן חיות.' },
    { l: 2, q: 'Match the place to what you do there:', match: [['supermarket', 'buy food'], ['beach', 'swim in the sea'], ['hospital', 'see a doctor'], ['restaurant', 'eat a meal']], why: 'supermarket – קונים אוכל, beach – שוחים בים, hospital – פוגשים רופא, restaurant – אוכלים ארוחה.' },
    { l: 2, q: 'Look: 📕🍎📗 The apple is ___ the two books.', a: 'between', d: ['under', 'behind', 'in'], why: 'between = בין. התפוח נמצא בין שני הספרים.' },
    { l: 2, q: 'Write the season after summer (two possible words):', text: ['autumn', 'fall'], why: 'אחרי הקיץ (summer) בא הסתיו: autumn, או fall באנגלית אמריקאית.' },
    { l: 3, q: 'Read: "The weather today: cloudy in the morning, sunny and windy in the afternoon." What is the weather in the afternoon?', a: 'sunny and windy', d: ['cloudy', 'rainy and cold', 'snowy'], why: 'כתוב: sunny and windy in the afternoon – שמשי ורוחני אחר הצהריים.' },
    { l: 3, q: 'Which words are about the weather?', multi: ['cloudy', 'windy', 'cold'], d: ['library', 'behind'], why: 'cloudy, windy, cold מתארים מזג אוויר. library היא ספרייה, ו־behind פירושו "מאחורי".' },
    { l: 3, q: 'Read: "My house is next to the park. The bus station is behind my house." What is behind the house?', a: 'the bus station', d: ['the park', 'the school', 'the beach'], why: 'כתוב: The bus station is behind my house – תחנת האוטובוס מאחורי הבית. הפארק נמצא ליד הבית (next to).' },
    { l: 3, q: 'Sara says: "Let’s go to the beach!" Which day is best for the beach?', a: 'a hot and sunny day', d: ['a cold and rainy day', 'a windy winter night', 'a cloudy and cold day'], why: 'הולכים לים ביום חם ושמשי – hot and sunny.' },
  ],
});

export const vocabularyTopics = [peopleFamily, dailyRoutine, placesThings];
