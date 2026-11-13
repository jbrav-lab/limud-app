import { bankTopic } from '../../../engine/bank';

const UNIT = 'grammar';

/* ---------------- to be, There is / There are ---------------- */
export const toBe = bankTopic({
  id: 'to-be',
  unit: UNIT,
  title: 'Am, Is, Are · There is / are',
  emoji: '🧩',
  lesson: [
    { kind: 'text', text: '**The verb "to be" (להיות) – בהווה:**\nI **am**\nhe / she / it **is**\nyou / we / they **are**' },
    { kind: 'example', text: 'I **am** ten. She **is** my friend. They **are** at school.' },
    { kind: 'text', text: '**שלילה:** מוסיפים not – I am **not** hungry. He **isn’t** (is not) here.\n**שאלה:** מקדימים את הפועל – **Is** she happy? **Are** you ready?' },
    { kind: 'text', text: '**There is / There are – יש:**\nThere **is** + אחד: There is a cat in the garden.\nThere **are** + הרבה: There are three cats in the garden.' },
    { kind: 'tip', text: 'שאלה: **Is there** a park near your house? **Are there** any apples?' },
  ],
  items: [
    { l: 1, q: 'She ___ my best friend.', a: 'is', d: ['am', 'are', 'be'], why: 'עם she משתמשים ב־**is**.' },
    { l: 1, q: 'I ___ ten years old.', a: 'am', d: ['is', 'are', 'be'], why: 'עם I משתמשים תמיד ב־**am**.' },
    { l: 1, q: 'We ___ in the classroom.', a: 'are', d: ['is', 'am', 'be'], why: 'עם we, you, they משתמשים ב־**are**.' },
    { l: 1, q: 'There ___ a dog in the garden.', a: 'is', d: ['are', 'am', 'be'], why: 'כלב אחד (a dog) ← There **is**.' },
    { l: 2, q: 'There ___ five pencils in my bag.', a: 'are', d: ['is', 'am', 'be'], why: 'חמישה עפרונות – יותר מאחד ← There **are**.' },
    { l: 2, q: 'Choose the correct question:', a: 'Are you hungry?', d: ['You are hungry?', 'Is you hungry?', 'Am you hungry?'], why: 'בשאלה מקדימים את הפועל: **Are** you…? ועם you תמיד are.' },
    { l: 2, q: 'Write the missing word: He ___ not at home. He is at school.', text: ['is'], why: 'He **is** not at home – הוא לא בבית.' },
    { l: 2, tf: '"They is my friends" is a correct sentence.', t: false, why: 'עם they אומרים **are**: They are my friends.' },
    { l: 3, q: 'Choose the correct sentence:', a: 'There are two books on the table.', d: ['There is two books on the table.', 'There are a book on the table.', 'There am two books on the table.'], why: 'two books – רבים ← There **are**.' },
    { l: 3, q: '"___ there a park near your house?" "Yes, there is."', a: 'Is', d: ['Are', 'Am', 'Do'], why: 'התשובה היא Yes, there **is** – לכן השאלה היא **Is** there…?' },
    { l: 3, q: 'Write the short form of "is not":', text: ["isn't", 'isnt'], why: 'is not = **isn’t**. (are not = aren’t)' },
    { l: 3, q: 'Which sentences are correct?', multi: ['I am happy.', 'They are at the zoo.', 'There is a bird on the tree.'], d: ['She are tall.', 'There are a cat.'], why: 'She **is** tall. There **is** a cat (חתול אחד).' },
  ],
});

/* ---------------- Present simple ---------------- */
export const presentSimple = bankTopic({
  id: 'present-simple',
  unit: UNIT,
  title: 'Present Simple',
  emoji: '🔁',
  lesson: [
    { kind: 'text', text: '**Present Simple** מתאר דברים שקורים **תמיד**, **כל יום** או **בדרך כלל** – הרגלים ועובדות.' },
    { kind: 'example', text: 'I **play** football every day. The sun **rises** in the morning.' },
    { kind: 'text', text: 'עם **he / she / it** מוסיפים **s** לפועל:\nI play → she play**s**\nI watch → he watch**es**\nI study → she stud**ies**' },
    { kind: 'text', text: '**שלילה:** I **don’t** like fish. She **doesn’t** like fish. (אחרי doesn’t – בלי s!)\n**שאלה:** **Do** you like pizza? **Does** he like pizza?' },
    { kind: 'tip', text: 'מילים שמרמזות על Present Simple:\nevery day, always, usually, often, sometimes, never, on Mondays.' },
  ],
  items: [
    { l: 1, q: 'She ___ to school every day.', a: 'walks', d: ['walk', 'walking', 'walked'], why: 'she + every day ← מוסיפים s: she walk**s**.' },
    { l: 1, q: 'I ___ milk every morning.', a: 'drink', d: ['drinks', 'drinking', 'drinkes'], why: 'עם I לא מוסיפים s: I drink.' },
    { l: 1, q: 'They ___ football on Fridays.', a: 'play', d: ['plays', 'playing', 'is play'], why: 'עם they לא מוסיפים s: They play.' },
    { l: 1, tf: '"He like ice cream" is a correct sentence.', t: false, why: 'עם he מוסיפים s: He like**s** ice cream.' },
    { l: 2, q: 'My brother ___ TV after school.', a: 'watches', d: ['watch', 'watchs', 'watching'], why: 'פועל שנגמר ב־ch מקבל **es**: watch → watch**es**.' },
    { l: 2, q: '___ you like apples? – Yes, I do.', a: 'Do', d: ['Does', 'Are', 'Is'], why: 'שאלה עם you ← **Do** you…? והתשובה Yes, I **do**.' },
    { l: 2, q: 'She ___ like spiders.', a: "doesn't", d: ["don't", "isn't", "doesn't likes"], why: 'שלילה עם she ← **doesn’t** like (והפועל בלי s).' },
    { l: 2, q: 'Write the verb with -s or -es: Dan (go) ___ to bed at nine.', text: ['goes'], why: 'go מקבל **es**: he goes.' },
    { l: 3, q: 'Choose the correct question:', a: 'Does your sister play the piano?', d: ['Does your sister plays the piano?', 'Do your sister play the piano?', 'Your sister does play the piano?'], why: 'עם your sister (היא) משתמשים ב־**Does**, ואחריו הפועל בלי s: play.' },
    { l: 3, q: 'Write the verb: Maya (study) ___ English on Mondays.', text: ['studies'], why: 'פועל שנגמר בעיצור + y: מחליפים y ב־**ies** – study → stud**ies**.' },
    { l: 3, q: 'Which sentences are correct?', multi: ['He usually eats lunch at school.', 'We never watch TV in the morning.', 'Does she like music?'], d: ['She don’t like music.', 'He eat lunch at home.'], why: 'She **doesn’t** like music. He **eats** lunch at home.' },
    { l: 3, q: 'Read: "Gal gets up at 7:00. He has breakfast and walks to school. He never takes the bus." How does Gal go to school?', a: 'He walks.', d: ['He takes the bus.', 'He rides a bike.', 'His mother drives him.'], why: 'כתוב: walks to school, ו־never takes the bus – הוא אף פעם לא נוסע באוטובוס.' },
  ],
});

/* ---------------- Present progressive ---------------- */
export const presentProgressive = bankTopic({
  id: 'present-progressive',
  unit: UNIT,
  title: 'Present Progressive',
  emoji: '🏃',
  lesson: [
    { kind: 'text', text: '**Present Progressive** מתאר מה שקורה **עכשיו**, ברגע זה.' },
    { kind: 'text', text: 'בונים: **am / is / are** + פועל עם **ing**\nI **am reading**. She **is running**. They **are playing**.' },
    { kind: 'example', text: 'Look! The baby **is sleeping**. Shhh!' },
    { kind: 'text', text: 'כללי כתיב:\nmake → mak**ing** (מורידים e)\nrun → ru**nn**ing, swim → swi**mm**ing (מכפילים את האות האחרונה)' },
    { kind: 'tip', text: 'מילים שמרמזות על הווה מתמשך: now, right now, at the moment, Look!, Listen!\nלעומת Present Simple: every day, always, usually.' },
  ],
  items: [
    { l: 1, q: 'Look! The dog ___ running.', a: 'is', d: ['are', 'am', 'do'], why: 'the dog = it ← **is** running.' },
    { l: 1, q: 'I am ___ a book now.', a: 'reading', d: ['read', 'reads', 'readed'], why: 'אחרי am בהווה מתמשך בא פועל עם **ing**: reading.' },
    { l: 1, q: 'The children ___ playing in the park.', a: 'are', d: ['is', 'am', 'be'], why: 'the children = they ← **are** playing.' },
    { l: 1, tf: '"She is singing" tells us what she is doing now.', t: true, why: 'is singing – היא שרה עכשיו.' },
    { l: 2, q: 'Write the -ing form of "swim":', text: ['swimming'], why: 'swim מסתיים בתנועה קצרה ועיצור, לכן מכפילים את m: swi**mm**ing.' },
    { l: 2, q: 'Listen! Somebody ___ at the door.', a: 'is knocking', d: ['knocks', 'knocking', 'are knocking'], why: 'Listen! = עכשיו ← הווה מתמשך. somebody (מישהו) ← **is** knocking.' },
    { l: 2, q: 'Choose the correct question:', a: 'Are you watching TV?', d: ['You are watching TV?', 'Do you watching TV?', 'Is you watching TV?'], why: 'בשאלה מקדימים את are: **Are** you watching…?' },
    { l: 2, q: 'Write the -ing form of "make":', text: ['making'], why: 'make מסתיים ב־e – מורידים אותה: mak**ing**.' },
    { l: 3, q: 'Choose the correct verb: I usually ___ to school, but today I am taking the bus.', a: 'walk', d: ['am walking', 'walking', 'walks'], why: 'usually = בדרך כלל ← Present Simple: I **walk**. today… am taking ← מה שקורה עכשיו.' },
    { l: 3, q: 'Choose the correct verb: Be quiet! Grandpa ___ .', a: 'is sleeping', d: ['sleeps', 'sleep', 'are sleeping'], why: 'Be quiet! – עכשיו ← הווה מתמשך: Grandpa **is sleeping**.' },
    { l: 3, q: 'Which sentences tell what is happening **now**?', multi: ['It is raining.', 'They are eating lunch.', 'I am writing a letter.'], d: ['It rains a lot in winter.', 'They eat lunch at one o’clock.'], why: 'am / is / are + ing = עכשיו. It rains a lot in winter ו־They eat lunch at one o’clock הם הרגלים – Present Simple.' },
    { l: 3, q: 'Match each sentence to its meaning:', match: [['She plays tennis.', 'זה ההרגל שלה'], ['She is playing tennis.', 'היא משחקת עכשיו']], why: 'Present Simple – הרגל או עובדה. Present Progressive – מה שקורה עכשיו.' },
  ],
});

/* ---------------- Past simple ---------------- */
export const pastSimple = bankTopic({
  id: 'past-simple',
  unit: UNIT,
  title: 'Past Simple',
  emoji: '⏪',
  lesson: [
    { kind: 'text', text: '**Past Simple** מתאר דברים שקרו **בעבר** והסתיימו: yesterday, last week, two days ago, in 2020.' },
    { kind: 'text', text: '**was / were** (עבר של to be):\nI / he / she / it **was**\nyou / we / they **were**' },
    { kind: 'text', text: '**פעלים רגילים** – מוסיפים **ed**:\nplay → play**ed**, walk → walk**ed**, like → lik**ed**, stop → sto**pp**ed' },
    { kind: 'text', text: '**פעלים יוצאי דופן** – צריך לזכור:\ngo → **went**, eat → **ate**, see → **saw**, have → **had**, come → **came**, buy → **bought**, write → **wrote**, take → **took**' },
    { kind: 'tip', text: 'שלילה ושאלה: I **didn’t go**. **Did** you **see** it? – אחרי did/didn’t הפועל חוזר לצורה הרגילה.' },
  ],
  items: [
    { l: 1, q: 'Yesterday I ___ football with my friends.', a: 'played', d: ['play', 'plays', 'playing'], why: 'yesterday = אתמול ← עבר: play**ed**.' },
    { l: 1, q: 'Last summer we ___ at the beach.', a: 'were', d: ['was', 'are', 'is'], why: 'עבר עם we ← **were**.' },
    { l: 1, q: 'She ___ sick last week.', a: 'was', d: ['were', 'is', 'are'], why: 'עבר עם she ← **was**.' },
    { l: 1, q: 'Write the past form of "walk":', text: ['walked'], why: 'פועל רגיל: walk + ed = walk**ed**.' },
    { l: 2, q: 'Yesterday we ___ to the zoo.', a: 'went', d: ['goed', 'go', 'goes'], why: 'go הוא פועל יוצא דופן: העבר שלו הוא **went**.' },
    { l: 2, q: 'Match the verb to its past form:', match: [['eat', 'ate'], ['see', 'saw'], ['have', 'had'], ['write', 'wrote']], why: 'פעלים יוצאי דופן: eat–ate, see–saw, have–had, write–wrote.' },
    { l: 2, q: 'Write the past form of "buy":', text: ['bought'], why: 'buy → **bought** (יוצא דופן).' },
    { l: 2, tf: '"Last night I watch a movie" is correct.', t: false, why: 'last night = אתמול בלילה ← עבר: I watch**ed** a movie.' },
    { l: 3, q: 'Choose the correct question:', a: 'Did you see the game?', d: ['Did you saw the game?', 'Do you saw the game?', 'You did see the game?'], why: 'אחרי **Did** הפועל בצורה הרגילה: Did you **see**…?' },
    { l: 3, q: 'I ___ my homework yesterday, so the teacher was angry.', a: "didn't do", d: ["didn't did", "don't do", "doesn't do"], why: 'שלילה בעבר: **didn’t** + פועל רגיל: didn’t **do**.' },
    { l: 3, q: 'Read: "On Monday Noa went to the library. She took two books and read them at home." What did Noa do at the library?', a: 'She took two books.', d: ['She read the books at the library.', 'She bought two books.', 'She went with her mother.'], why: 'כתוב: She took two books – היא לקחה שני ספרים, וקראה אותם **בבית** (at home).' },
    { l: 3, q: 'Put the story in order:', order: ['Dan woke up late.', 'He ran to the bus station.', 'The bus was gone.', 'He walked to school.'], why: 'קודם התעורר מאוחר, אחר כך רץ לתחנה, האוטובוס כבר נסע – אז הלך ברגל.' },
  ],
});

/* ---------------- can, going to ---------------- */
export const canGoingTo = bankTopic({
  id: 'can-going-to',
  unit: UNIT,
  title: 'Can · Going to',
  emoji: '💪',
  lesson: [
    { kind: 'text', text: '**can** = יכול/ה (יכולת). אחרי can בא הפועל **בלי** s ובלי to:\nI **can swim**. She **can ride** a bike.' },
    { kind: 'text', text: '**can’t** (cannot) = לא יכול/ה: Penguins **can’t fly**.\n**שאלה:** **Can** you **play** the guitar? – Yes, I can. / No, I can’t.' },
    { kind: 'text', text: '**going to** = תוכנית לעתיד (הרחבה):\nI **am going to** visit my grandma tomorrow.\nThey **are going to** play football.' },
    { kind: 'tip', text: 'מילים לעתיד:\ntomorrow, next week, this evening, soon.' },
  ],
  items: [
    { l: 1, q: 'Fish ___ swim.', a: 'can', d: ['can’t', 'cans', 'are'], why: 'דגים יכולים לשחות – Fish **can** swim.' },
    { l: 1, q: 'A cat ___ fly.', a: "can't", d: ['can', 'is', 'does'], why: 'חתול לא יכול לעוף – A cat **can’t** fly.' },
    { l: 1, q: 'She can ___ very fast.', a: 'run', d: ['runs', 'running', 'to run'], why: 'אחרי can בא הפועל בצורה הרגילה: can **run**.' },
    { l: 1, tf: '"Can you speak English?" is a question.', t: true, why: 'Can בתחילת המשפט ← שאלה: האם את/ה יכול/ה לדבר אנגלית?' },
    { l: 2, q: 'Choose the correct sentence:', a: 'My brother can play the piano.', d: ['My brother cans play the piano.', 'My brother can plays the piano.', 'My brother can to play the piano.'], why: 'can לא משתנה ולא מקבל s, ואחריו פועל רגיל בלי to.' },
    { l: 2, q: '"Can you ride a horse?" – "No, I ___."', a: "can't", d: ['don’t', 'am not', 'not'], why: 'תשובה קצרה לשאלה עם Can: Yes, I can. / No, I **can’t**.' },
    { l: 2, q: 'Tomorrow I am going ___ visit my grandma.', a: 'to', d: ['for', 'at', 'in'], why: 'הצירוף הוא am going **to** + פועל.' },
    { l: 2, q: 'Write the missing word: Babies ___ walk. They are too young.', text: ["can't", 'cant', 'cannot', 'can not'], why: 'תינוקות עוד לא יכולים ללכת: Babies **can’t** walk.' },
    { l: 3, q: 'Next Saturday they ___ to the beach.', a: 'are going to go', d: ['is going to go', 'going to go', 'are go to'], why: 'next Saturday = תוכנית לעתיד ← they **are going to** go.' },
    { l: 3, q: 'Which sentences are about the **future**?', multi: ['I am going to buy a new bag.', 'We are going to visit Eilat next week.'], d: ['I can swim.', 'She went to the park yesterday.', 'He plays tennis every day.'], why: 'going to + next week / tomorrow – תוכניות לעתיד. went – עבר; plays every day – הרגל; can swim – יכולת.' },
    { l: 3, q: 'Read: "Hi Gal! I can’t come to your party on Friday. I am going to fly to London with my family. Sorry! Yoni" Why can’t Yoni come?', a: 'He is going to fly to London.', d: ['He is sick.', 'He doesn’t like parties.', 'He has a lot of homework.'], why: 'יוני כותב: I am going to fly to London – הוא טס ללונדון עם המשפחה.' },
    { l: 3, q: 'Match the question to the answer:', match: [['Can you swim?', 'Yes, I can.'], ['Are you going to swim tomorrow?', 'Yes, I am.'], ['Do you swim every day?', 'Yes, I do.']], why: 'עונים באותה מילה שבה מתחילה השאלה: Can → can, Are → am, Do → do.' },
  ],
});

/* ---------------- a / an / the, plurals, possessive ---------------- */
export const nounsArticles = bankTopic({
  id: 'nouns-articles',
  unit: UNIT,
  title: 'A, An, The · Plurals · Whose?',
  emoji: '🍎',
  lesson: [
    { kind: 'text', text: '**a / an** = אחד, כלשהו:\n**a** לפני צליל של עיצור: a dog, a book, a uniform\n**an** לפני צליל של תנועה (a, e, i, o, u): an apple, an egg, an hour' },
    { kind: 'text', text: '**the** = ה־ הידיעה – משהו מסוים שכבר יודעים עליו: I have a cat. **The** cat is black.' },
    { kind: 'text', text: '**רבים:** בדרך כלל מוסיפים **s**: book → books\nאחרי s, sh, ch, x מוסיפים **es**: box → box**es**, bus → bus**es**\nיוצאי דופן: child → **children**, man → **men**, woman → **women**, foot → **feet**, tooth → **teeth**, mouse → **mice**' },
    { kind: 'text', text: '**של מי? – Possessive:** Dana**’s** bag = התיק של דנה\nmy, your, his, her, our, their: This is **her** book.' },
  ],
  items: [
    { l: 1, q: 'I eat ___ apple every day.', a: 'an', d: ['a', 'the two', 'two'], why: 'apple מתחילה בצליל תנועה ← **an** apple.' },
    { l: 1, q: 'She has ___ dog.', a: 'a', d: ['an', 'two', 'many'], why: 'dog מתחילה בעיצור ← **a** dog.' },
    { l: 1, q: 'Write the plural: one cat, two ___', text: ['cats'], why: 'ברוב המילים מוסיפים s: cat → cat**s**.' },
    { l: 1, q: 'This bag belongs to Ron. It is ___ bag.', a: 'Ron’s', d: ['Rons', 'Ron', 'of Ron'], why: 'שייכות: **’s** אחרי השם – Ron’s bag.' },
    { l: 2, q: 'Write the plural: one box, two ___', text: ['boxes'], why: 'אחרי x מוסיפים **es**: box**es**.' },
    { l: 2, q: 'One child, three ___.', a: 'children', d: ['childs', 'childes', 'childrens'], why: 'child הוא יוצא דופן: הרבים הוא **children**.' },
    { l: 2, q: 'Match singular to plural:', match: [['man', 'men'], ['foot', 'feet'], ['tooth', 'teeth'], ['mouse', 'mice']], why: 'אלה רבים יוצאי דופן – צריך לזכור אותם.' },
    { l: 2, q: 'Maya has a new bike. ___ bike is red.', a: 'Her', d: ['His', 'Their', 'My'], why: 'מאיה היא בת ← **her** bike (האופניים שלה).' },
    { l: 3, q: 'I saw a dog in the park. ___ dog was very big.', a: 'The', d: ['A', 'An', 'Some'], why: 'כבר דיברנו על הכלב הזה – עכשיו הוא מסוים ← **The** dog.' },
    { l: 3, q: 'Which are correct?', multi: ['an orange', 'an hour', 'a uniform'], d: ['an banana', 'a egg'], why: 'an לפני **צליל** תנועה: an orange, an hour (h לא נשמעת), an egg. a uniform – נשמע "יוּ", צליל עיצור; a banana.' },
    { l: 3, q: 'The boys have a ball. It is ___ ball.', a: 'their', d: ['his', 'her', 'there'], why: 'the boys = הם ← **their** ball. (there פירושו "שם".)' },
    { l: 3, q: 'Choose the correct sentence:', a: 'The women are talking to the children.', d: ['The womans are talking to the childs.', 'The women is talking to the children.', 'The woman are talking to the childrens.'], why: 'women ו־children הם רבים יוצאי דופן, ועם רבים משתמשים ב־are.' },
  ],
});

/* ---------------- Wh- questions ---------------- */
export const whQuestions = bankTopic({
  id: 'wh-questions',
  unit: UNIT,
  title: 'Wh- Questions',
  emoji: '❓',
  lesson: [
    { kind: 'text', text: '**Who** – מי? (person)\n**What** – מה? (thing)\n**Where** – איפה? (place)\n**When** – מתי? (time)\n**Why** – למה? (reason)\n**How** – איך? / **How many** – כמה? / **How old** – בן/בת כמה?\n**Which** – איזה?  **Whose** – של מי?' },
    { kind: 'example', text: '**Where** do you live? – In Haifa.\n**When** is your birthday? – In May.' },
    { kind: 'tip', text: 'סדר המילים בשאלה: מילת שאלה + is/are/do/does/did/can + נושא: Where **do you** live? What **is she** doing?' },
  ],
  items: [
    { l: 1, q: '___ do you live? – In Tel Aviv.', a: 'Where', d: ['When', 'Who', 'Why'], why: 'התשובה היא מקום ← **Where**.' },
    { l: 1, q: '___ is your teacher? – Mrs. Cohen.', a: 'Who', d: ['What', 'Where', 'How'], why: 'התשובה היא אדם ← **Who**.' },
    { l: 1, q: '___ is your birthday? – In June.', a: 'When', d: ['Where', 'Who', 'What'], why: 'התשובה היא זמן ← **When**.' },
    { l: 1, q: '___ old are you? – I am eleven.', a: 'How', d: ['What', 'Who', 'When'], why: '**How old** = בן/בת כמה.' },
    { l: 2, q: '___ are you sad? – Because I lost my ball.', a: 'Why', d: ['Who', 'Where', 'How'], why: 'התשובה מתחילה ב־Because (כי) ← **Why**.' },
    { l: 2, q: 'Match the question word to the answer:', match: [['Who?', 'My cousin.'], ['Where?', 'At the park.'], ['When?', 'At five o’clock.'], ['How many?', 'Three.']], why: 'Who – אדם, Where – מקום, When – זמן, How many – מספר.' },
    { l: 2, q: '___ pencils do you have? – Six.', a: 'How many', d: ['How old', 'What', 'Which'], why: 'התשובה היא כמות ← **How many**.' },
    { l: 2, q: 'Choose the correct question:', a: 'What is she eating?', d: ['What she is eating?', 'What eating she is?', 'What does she eating?'], why: 'מילת שאלה + **is** + נושא: What **is she** eating?' },
    { l: 3, q: 'Choose the correct question:', a: 'Where did you go yesterday?', d: ['Where you went yesterday?', 'Where did you went yesterday?', 'Where you did go yesterday?'], why: 'בעבר: Where + **did** + you + פועל רגיל (go).' },
    { l: 3, q: '___ bag is this? – It’s Noa’s.', a: 'Whose', d: ['Who', 'Where', 'Which'], why: 'התשובה מראה שייכות (Noa’s) ← **Whose** = של מי.' },
    { l: 3, q: 'Read: "Lior plays basketball at the community center every Tuesday at 4:00." Which question has the answer "every Tuesday"?', a: 'When does Lior play basketball?', d: ['Where does Lior play basketball?', 'Who plays basketball?', 'What does Lior play?'], why: 'every Tuesday היא תשובה על זמן ← **When**.' },
    { l: 3, q: 'Put the words in order to make a question:', order: ['What', 'does', 'your', 'brother', 'like?'], why: 'What + does + your brother + like?' },
  ],
});

/* ---------------- Comparatives (enrichment) ---------------- */
export const comparatives = bankTopic({
  id: 'comparatives',
  unit: UNIT,
  title: 'Comparing: -er, -est',
  emoji: '📏',
  lesson: [
    { kind: 'text', text: 'משווים בין **שניים** – מוסיפים **er** + than:\nA horse is **bigger than** a dog.' },
    { kind: 'text', text: 'הכי – מתוך **הרבה** – the + **est**:\nThe elephant is **the biggest** animal in the zoo.' },
    { kind: 'text', text: 'כללי כתיב:\ntall → tall**er** → tall**est**\nbig → bi**gg**er → bi**gg**est\nhappy → happ**ier** → happ**iest**\nnice → nic**er** → nic**est**' },
    { kind: 'text', text: 'מילים ארוכות: **more** / **the most**: beautiful → more beautiful → the most beautiful' },
    { kind: 'tip', text: 'יוצאי דופן: good → **better** → **the best**; bad → **worse** → **the worst**.' },
  ],
  items: [
    { l: 1, q: 'A giraffe is ___ than a dog.', a: 'taller', d: ['tall', 'tallest', 'more tall'], why: 'משווים בין שניים ← tall**er** than.' },
    { l: 1, q: 'An elephant is ___ than a cat.', a: 'bigger', d: ['biger', 'big', 'biggest'], why: 'big ← מכפילים את g: bi**gg**er.' },
    { l: 1, q: 'Write the comparative of "small": small → ___', text: ['smaller'], why: 'small + er = small**er**.' },
    { l: 1, tf: '"The cheetah is the fastest animal on land" compares many animals.', t: true, why: 'the + est = הכי מכולם.' },
    { l: 2, q: 'Mount Everest is ___ mountain in the world.', a: 'the highest', d: ['higher', 'the higher', 'highest than'], why: 'הכי גבוה מכל ההרים ← **the highest**.' },
    { l: 2, q: 'Write the comparative of "happy": happy → ___', text: ['happier'], why: 'y אחרי עיצור הופכת ל־i: happ**ier**.' },
    { l: 2, q: 'My test score is good, but Dana’s score is ___.', a: 'better', d: ['gooder', 'more good', 'best'], why: 'good הוא יוצא דופן: good → **better** → the best.' },
    { l: 2, q: 'Match:', match: [['good', 'better'], ['bad', 'worse'], ['big', 'bigger']], why: 'good–better ו־bad–worse הם יוצאי דופן. big–bigger לפי הכלל.' },
    { l: 3, q: 'This book is ___ than that one.', a: 'more interesting', d: ['interestinger', 'most interesting', 'more interestinger'], why: 'מילה ארוכה ← **more** interesting than.' },
    { l: 3, q: 'Read: "Tom is 140 cm tall. Ben is 150 cm. Sam is 145 cm." Who is the tallest?', a: 'Ben', d: ['Tom', 'Sam', 'They are the same'], why: '150 הוא המספר הגדול ביותר ← Ben is **the tallest**.' },
    { l: 3, q: 'Which sentences are correct?', multi: ['A car is faster than a bike.', 'Summer is hotter than winter.', 'She is the best player in the team.'], d: ['A mouse is biggest than a cat.', 'He is more tall than me.'], why: 'A mouse is **smaller** than a cat. He is **taller** than me.' },
    { l: 3, q: 'Put in order from the **smallest** to the **biggest**:', order: ['an ant', 'a mouse', 'a dog', 'a horse', 'an elephant'], why: 'נמלה < עכבר < כלב < סוס < פיל.' },
  ],
});

export const grammarTopics = [toBe, presentSimple, presentProgressive, pastSimple, canGoingTo, nounsArticles, whQuestions, comparatives];
