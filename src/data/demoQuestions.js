export const DEMO_EXAM_TITLE = "Athena Demonstration Examination";

export const DEMO_EXAM_DURATION_SECONDS = 20 * 60;

export const DEMO_EXAM_POLICY = Object.freeze({
  recordFullscreenInterruptions: true,
});

export const demoQuestions = [
  {
    id: "q1",
    question: "Which data structure follows the Last-In, First-Out (LIFO) principle?",
    options: [
      { id: "a", text: "Queue" },
      { id: "b", text: "Stack" },
      { id: "c", text: "Binary search tree" },
      { id: "d", text: "Graph" },
    ],
    correctAnswerId: "b",
  },
  {
    id: "q2",
    question: "Which JavaScript keyword declares a block-scoped variable that can be reassigned?",
    options: [
      { id: "a", text: "const" },
      { id: "b", text: "static" },
      { id: "c", text: "let" },
      { id: "d", text: "interface" },
    ],
    correctAnswerId: "c",
  },
  {
    id: "q3",
    question: "What is the average time complexity of binary search on a sorted array?",
    options: [
      { id: "a", text: "O(1)" },
      { id: "b", text: "O(log n)" },
      { id: "c", text: "O(n)" },
      { id: "d", text: "O(n²)" },
    ],
    correctAnswerId: "b",
  },
  {
    id: "q4",
    question: "What does HTTP status code 404 normally indicate?",
    options: [
      { id: "a", text: "The requested resource was not found" },
      { id: "b", text: "The request succeeded" },
      { id: "c", text: "The server has restarted" },
      { id: "d", text: "The user has logged in successfully" },
    ],
    correctAnswerId: "a",
  },
  {
    id: "q5",
    question: "Which SQL command is used to retrieve records from a table?",
    options: [
      { id: "a", text: "UPDATE" },
      { id: "b", text: "INSERT" },
      { id: "c", text: "SELECT" },
      { id: "d", text: "DROP" },
    ],
    correctAnswerId: "c",
  },
  {
    id: "q6",
    question: "What normally happens when a React component's state changes?",
    options: [
      { id: "a", text: "The entire operating system restarts" },
      { id: "b", text: "React schedules a re-render when needed" },
      { id: "c", text: "All browser storage is automatically erased" },
      { id: "d", text: "The component is permanently deleted" },
    ],
    correctAnswerId: "b",
  },
];

export default demoQuestions;