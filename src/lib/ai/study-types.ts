export type StudyFlashcard = {
  front: string;
  back: string;
};

export type StudyFlashcardDeck = {
  title: string;
  cards: StudyFlashcard[];
};

export type StudyQuizQuestion = {
  id: string;
  type: "mcq" | "true_false" | "short";
  prompt: string;
  options?: string[];
  answer: string;
  explanation?: string;
};

export type StudyQuiz = {
  title: string;
  questions: StudyQuizQuestion[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  audioUrl?: string;
};
