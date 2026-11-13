import { bankTopic } from '../../../engine/bank';

const UNIT = 'literacy';

/* ---------------- Reading comprehension ---------------- */
const AD = '**SUMMER FUN DAY!**\nWhere: Green Park\nWhen: Friday, July 10, 10:00–14:00\nGames, music and free ice cream!\nTickets: 20 shekels. Children under 6: free.';
const EMAIL = '**Hi Noa,**\nI’m at my grandparents’ house in the north. It’s cold and rainy here, but it’s fun. Yesterday we went to a chocolate factory! Tomorrow we are going to ride horses.\nSee you on Sunday,\nMaya';
const STORY = '**The Lost Kitten**\nOne morning Ben heard a small noise under his window. He looked down and saw a little gray kitten. It was wet and hungry. Ben gave it some milk and a warm towel. The kitten’s name was on its collar: "Pepper". Ben and his mom called the phone number on the collar. In the evening a happy girl came to take Pepper home.';

export const reading = bankTopic({
  id: 'reading',
  unit: UNIT,
  title: 'Reading',
  emoji: '📖',
  lesson: [
    { kind: 'text', text: '**איך קוראים טקסט באנגלית?**\n1. קוראים את הכותרת ומסתכלים בתמונות – על מה הטקסט?\n2. קוראים את השאלה, ואז מחפשים בטקסט את המילים מהשאלה.\n3. קוראים שוב את המשפט שמסביב – שם נמצאת התשובה.' },
    { kind: 'text', text: '**סוגי טקסטים:** מודעה (ad), הודעה או מכתב (message, email), לוח זמנים (timetable), סיפור (story), הוראות (instructions).' },
    { kind: 'tip', text: 'מילות שאלה עוזרות לדעת מה לחפש: Where – מקום, When – זמן, Who – אדם, How many – מספר.' },
  ],
  items: [
    { l: 1, q: `${AD}\n\nWhere is the Summer Fun Day?`, a: 'at Green Park', d: ['at school', 'at the beach', 'at the zoo'], why: 'בשורה Where כתוב: Green Park.' },
    { l: 1, q: `${AD}\n\nWhat day is the Summer Fun Day?`, a: 'Friday', d: ['Sunday', 'Monday', 'Saturday'], why: 'בשורה When כתוב: Friday, July 10.' },
    { l: 1, q: `${AD}\n\nHow much is a ticket (in shekels)?`, num: 20, why: 'כתוב: Tickets: 20 shekels.' },
    { l: 1, q: `${EMAIL}\n\nWho wrote the email?`, a: 'Maya', d: ['Noa', 'Grandma', 'Noa’s mother'], why: 'בסוף ההודעה חתומה Maya. ההודעה נשלחה ל־Noa (Hi Noa).' },
    { l: 2, q: `${EMAIL}\n\nWhat is the weather like at the grandparents’ house?`, a: 'cold and rainy', d: ['hot and sunny', 'windy and hot', 'snowy'], why: 'כתוב: It’s cold and rainy here.' },
    { l: 2, q: `${EMAIL}\n\nWhat did Maya do **yesterday**?`, a: 'She went to a chocolate factory.', d: ['She rode horses.', 'She went home.', 'She went to the beach.'], why: 'Yesterday we went to a chocolate factory. רכיבה על סוסים היא **מחר** (Tomorrow).' },
    { l: 2, q: `${AD}\n\nTom is 5 years old. How much does he pay?`, a: 'nothing – it is free', d: ['20 shekels', '10 shekels', '6 shekels'], why: 'Children under 6: free – ילדים מתחת לגיל 6 נכנסים בחינם.' },
    { l: 2, tf: `${EMAIL}\n\nMaya is having a bad time.`, t: false, why: 'מאיה כותבת: but it’s fun – כיף לה, למרות הגשם.' },
    { l: 3, q: `${STORY}\n\nWhere did Ben find the kitten?`, a: 'under his window', d: ['in the park', 'in the kitchen', 'at school'], why: 'כתוב: Ben heard a small noise under his window.' },
    { l: 3, q: `${STORY}\n\nHow did Ben find the kitten’s owner?`, a: 'They called the phone number on the collar.', d: ['He put up a sign.', 'He asked his teacher.', 'The kitten went home alone.'], why: 'Ben and his mom called the phone number on the collar.' },
    { l: 3, q: `${STORY}\n\nPut the events in order:`, order: ['Ben heard a noise.', 'He saw a wet kitten.', 'He gave it milk.', 'They called the number.', 'A girl came to take Pepper.'], why: 'זה הסדר שבו הדברים קרו בסיפור.' },
    { l: 3, q: `${STORY}\n\nHow did the girl feel in the evening?`, a: 'happy', d: ['angry', 'tired', 'scared'], why: 'כתוב: a happy girl came to take Pepper home.' },
  ],
});

/* ---------------- Spelling and phonics ---------------- */
export const spelling = bankTopic({
  id: 'spelling',
  unit: UNIT,
  title: 'Spelling and Sounds',
  emoji: '✍️',
  lesson: [
    { kind: 'text', text: '**Magic e:** e בסוף המילה לא נשמעת, אבל משנה את צליל התנועה שלפניה:\ncap → cap**e**, kit → kit**e**, hop → hop**e**, cut → cut**e**' },
    { kind: 'text', text: '**צירופי אותיות:**\n**ee / ea** – כמו "אִי": tree, sea\n**igh** – כמו "אַיי": night, light\n**oo** – כמו "אוּ": moon, school\n**sh, ch, th** – ש, צ׳, ת׳: ship, chair, three' },
    { kind: 'text', text: '**מילים שכדאי לזכור בעל פה:** who, which, where, there, their, because, friend, people, beautiful' },
    { kind: 'tip', text: 'כותבים את התשובה במקלדת. אותיות גדולות או קטנות – לא משנה.' },
  ],
  items: [
    { l: 1, q: 'Write the word: 🌙 (Hint: m _ _ n)', text: ['moon'], why: '**moon** = ירח. oo נשמע "אוּ".' },
    { l: 1, q: 'Write the word: 🌳 (Hint: t _ _ e)', text: ['tree'], why: '**tree** = עץ. ee נשמע "אִי".' },
    { l: 1, q: 'Which word has the same sound as "night"?', a: 'light', d: ['lit', 'let', 'lot'], why: 'night ו־**light** – שתיהן עם igh ("אַיי").' },
    { l: 1, q: 'Write the number in words: 3', text: ['three'], why: '3 = **three**. th בהתחלה.' },
    { l: 2, q: 'Add magic e: kit + e = ___ (🪁)', text: ['kite'], why: 'kit (ערכה) + e = **kite** (עפיפון). ה־i נשמעת "אַיי".' },
    { l: 2, q: 'Which word is spelled correctly?', a: 'because', d: ['becaus', 'bicause', 'becose'], why: 'כותבים **because** = כי, מפני ש.' },
    { l: 2, q: 'Write the word: 🪑 (Hint: ch _ _ r)', text: ['chair'], why: '**chair** = כיסא. ch נשמע "צ׳".' },
    { l: 2, q: 'Which words have the "ee" sound (like "see")?', multi: ['sea', 'green', 'teacher'], d: ['bread', 'red'], why: 'sea, green, teacher – ea/ee נשמעים "אִי". ב־bread וב־red שומעים "אֶ".' },
    { l: 3, q: 'Choose the correct word: They are my friends. I love ___ dog.', a: 'their', d: ['there', 'they’re', 'thier'], why: '**their** = שלהם. there = שם. they’re = they are.' },
    { l: 3, q: 'Write the word: a person who is close to you and you like to play with (f _ _ _ _ d)', text: ['friend'], why: '**friend** = חבר. שימו לב: ie באמצע.' },
    { l: 3, q: 'Write the question word: ___ is your name? (W _ _ t)', text: ['what'], why: '**What** is your name? – מה שמך?' },
    { l: 3, q: 'Which word is spelled correctly?', a: 'beautiful', d: ['beutiful', 'beautifull', 'butiful'], why: 'כותבים **beautiful** = יפה – עם eau ו־l אחת בסוף.' },
  ],
});

export const literacyTopics = [reading, spelling];
