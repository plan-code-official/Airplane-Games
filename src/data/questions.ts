export interface Question {
  id: number;
  question: string;
  options: string[];
  answerIndex: number;
  category: 'math' | 'science' | 'general';
  categoryName: string;
}

export const QUESTIONS: Question[] = [
  // Math Questions (الرياضيات)
  {
    id: 1,
    question: "كم يساوي حاصل جمع: ٢ + ٣ ؟",
    options: ["٤", "٥", "٦", "٣"],
    answerIndex: 1,
    category: "math",
    categoryName: "الرياضيات الذكية 🔢"
  },
  {
    id: 2,
    question: "إذا كان معك ٣ تفاحات وأعطاك والدك تفاحتين، فكم تفاحة معك الآن؟",
    options: ["٤ تفاحات", "٣ تفاحات", "٥ تفاحات", "٦ تفاحات"],
    answerIndex: 2,
    category: "math",
    categoryName: "الرياضيات الذكية 🔢"
  },
  {
    id: 3,
    question: "ما هو الشكل الذي لديه ٣ أضلاع و٣ زوايا؟",
    options: ["المربع", "المستطيل", "المثلث", "الدائرة"],
    answerIndex: 2,
    category: "math",
    categoryName: "الرياضيات الذكية 🔢"
  },
  {
    id: 4,
    question: "كم يساوي: ١٠ - ٤ ؟",
    options: ["٥", "٦", "٧", "٤"],
    answerIndex: 1,
    category: "math",
    categoryName: "الرياضيات الذكية 🔢"
  },
  {
    id: 5,
    question: "ما هو العدد التالي في هذا النمط: ٢، ٤، ٦، ...؟",
    options: ["٧", "٨", "٩", "١٠"],
    answerIndex: 1,
    category: "math",
    categoryName: "الرياضيات الذكية 🔢"
  },

  {
    id: 6,
    question: "أي من الحيوانات التالية يعيش في الماء ويستطيع السباحة؟",
    options: ["الأسد", "العصفور", "السمكة", "الأرنب"],
    answerIndex: 2,
    category: "science",
    categoryName: "عالم العلوم الطبيعية 🌿"
  },
  {
    id: 7,
    question: "ما هو الكوكب المضيء والساخن الذي يمد الأرض بالدفء والنور صباحاً؟",
    options: ["القمر", "الشمس", "المريخ", "الأرض"],
    answerIndex: 1,
    category: "science",
    categoryName: "عالم العلوم الطبيعية 🌿"
  },
  {
    id: 8,
    question: "ما هو الحيوان الذي يُلقب بـ 'ملك الغابة'؟",
    options: ["النمر", "الأسد", "الفيل", "الفهد"],
    answerIndex: 1,
    category: "science",
    categoryName: "عالم العلوم الطبيعية 🌿"
  },
  {
    id: 9,
    question: "أي جزء من النبتة يمتص الماء والغذاء من التربة؟",
    options: ["الأوراق", "الأزهار", "الجذور", "الساق"],
    answerIndex: 2,
    category: "science",
    categoryName: "عالم العلوم الطبيعية 🌿"
  },
  {
    id: 10,
    question: "أي من هذه الحيوانات يعتبر من الطيور ويستطيع الطيران؟",
    options: ["الكلب", "الدلفين", "الصقر", "القطة"],
    answerIndex: 2,
    category: "science",
    categoryName: "عالم العلوم الطبيعية 🌿"
  },

  // General Questions (معلومات عامة وثقافة)
  {
    id: 11,
    question: "ما هو لون الموز الناضج اللذيذ؟",
    options: ["أحمر", "أزرق", "أصفر", "أخضر"],
    answerIndex: 2,
    category: "general",
    categoryName: "المعلومات العامة 💡"
  },
  {
    id: 12,
    question: "ما هو الشيء الذي نستخدمه لقص الأوراق والكرتون بحذر؟",
    options: ["المقلمة", "القلم", "المقص", "المسطرة"],
    answerIndex: 2,
    category: "general",
    categoryName: "المعلومات العامة 💡"
  },
  {
    id: 13,
    question: "ما هي وسيلة النقل التي تسير على قضبان حديدية وتصدر صوت 'توت توت'؟",
    options: ["السيارة", "القطار", "السفينة", "الطائرة"],
    answerIndex: 1,
    category: "general",
    categoryName: "المعلومات العامة 💡"
  },
  {
    id: 14,
    question: "أي فاكهة من هذه الفواكه مستديرة وحمراء أو خضراء ولها بذرة صغيرة؟",
    options: ["الموز", "البطيخ", "التفاح", "الفراولة"],
    answerIndex: 2,
    category: "general",
    categoryName: "المعلومات العامة 💡"
  },
  {
    id: 15,
    question: "كم عدد ألوان قوس قزح الجميلة؟",
    options: ["٥ ألوان", "٦ ألوان", "٧ ألوان", "٨ ألوان"],
    answerIndex: 2,
    category: "general",
    categoryName: "المعلومات العامة 💡"
  }
];

export const getQuestionsByCategory = (category: string | 'all'): Question[] => {
  if (category === 'all') return QUESTIONS;
  return QUESTIONS.filter(q => q.category === category);
};
