// ===== GLOBAL STATE =====
const state = {
    questions: [],
    currentIndex: 0,
    score: 0,
    selectedOption: null,
    timer: null,
    timePerQuestion: 15, // seconds per question
    highscores: JSON.parse(localStorage.getItem("highscores") || "[]")
};

// ===== UTILITY FUNCTIONS =====
function decodeHTML(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ===== API FETCH =====
async function fetchQuestions() {
    try {
        const res = await fetch("https://opentdb.com/api.php?amount=50");
        const data = await res.json();
        state.questions = data.results.map(q => ({
            category: q.category,
            question: decodeHTML(q.question),
            correct: q.correct_answer,
            options: shuffleArray([...q.incorrect_answers, q.correct_answer]),
            difficulty: q.difficulty
        }));
        renderQuestion();
    } catch (e) {
        console.error("Failed to fetch questions:", e);
        document.getElementById("app").innerHTML = "<p>Error loading questions!</p>";
    }
}

// ===== TIMER =====
function startTimer() {
    let timeLeft = state.timePerQuestion;
    const timerEl = document.getElementById("timer");
    timerEl.textContent = `⏱ ${timeLeft}s`;
    state.timer = setInterval(() => {
        timeLeft--;
        timerEl.textContent = `⏱ ${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(state.timer);
            handleSubmit(true);
        }
    }, 1000);
}

// ===== RENDER QUESTION =====
function renderQuestion() {
    clearInterval(state.timer);
    state.selectedOption = null;
    const q = state.questions[state.currentIndex];
    const optionsHTML = q.options.map((opt, i) =>
        `<button class="option-btn" data-index="${i}">${decodeHTML(opt)}</button>`
    ).join("");

    document.getElementById("app").innerHTML = `
        <div class="quiz-container">
            <header>
                <img src="images/mario.gif" class="mario">
                <h1>JavaScript Quiz Game</h1>
                <img src="images/mario.gif" class="mario flipped">
            </header>
            <div class="question-meta">
                <span class="category">${q.category}</span>
                <img src="images/${q.difficulty}.jpg" class="difficulty">
            </div>
            <h2 class="question-text">${q.question}</h2>
            <div id="options" class="options-grid">
                ${optionsHTML}
            </div>
            <div id="feedback" class="feedback"></div>
            <div class="controls">
                <div id="timer" class="timer">⏱ ${state.timePerQuestion}s</div>
                <button id="submit-btn" class="submit-btn">Submit</button>
            </div>
            <div class="progress-bar">
                <div class="progress" style="width: ${((state.currentIndex) / state.questions.length) * 100}%"></div>
            </div>
        </div>
    `;

    // Add option click listeners
    document.querySelectorAll(".option-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            state.selectedOption = btn.textContent;
            document.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
        });
    });

    // Add submit button listener
    document.getElementById("submit-btn").addEventListener("click", () => handleSubmit(false));

    startTimer();
}

// ===== HANDLE SUBMIT =====
function handleSubmit(timeout) {
    clearInterval(state.timer);
    const q = state.questions[state.currentIndex];
    const feedbackEl = document.getElementById("feedback");
    const correctAnswer = decodeHTML(q.correct);
    let message = "";
    let isCorrect = false;

    if (timeout) {
        message = `⏳ Time's up! Correct answer: ${correctAnswer}`;
        highlightCorrectAnswer();
    } else if (state.selectedOption === correctAnswer) {
        isCorrect = true;
        message = `✅ Correct!`;
        state.score += getScoreByDifficulty(q.difficulty);
        highlightCorrectAnswer();
    } else {
        message = `❌ Wrong! Correct answer: ${correctAnswer}`;
        highlightCorrectAnswer();
    }

    feedbackEl.textContent = message;
    feedbackEl.classList.remove("correct", "wrong");
    feedbackEl.classList.add(isCorrect ? "correct" : "wrong");

    // Disable all options after answer
    document.querySelectorAll(".option-btn").forEach(b => b.disabled = true);

    // Move to next question after 2 seconds
    setTimeout(() => {
        state.currentIndex++;
        if (state.currentIndex >= state.questions.length) {
            renderFinalScore();
        } else {
            renderQuestion();
        }
    }, 2000);
}

// ===== HIGHLIGHT CORRECT ANSWER =====
function highlightCorrectAnswer() {
    const q = state.questions[state.currentIndex];
    const correctAnswer = decodeHTML(q.correct);
    document.querySelectorAll(".option-btn").forEach(btn => {
        if (btn.textContent === correctAnswer) btn.classList.add("correct-answer");
    });
}

// ===== SCORING SYSTEM =====
function getScoreByDifficulty(diff) {
    switch (diff) {
        case "easy": return 10;
        case "medium": return 20;
        case "hard": return 30;
        default: return 0;
    }
}

// ===== FINAL SCORE =====
function renderFinalScore() {
    state.highscores.push(state.score);
    state.highscores.sort((a, b) => b - a);
    if (state.highscores.length > 10) state.highscores.pop();
    localStorage.setItem("highscores", JSON.stringify(state.highscores));

    document.getElementById("app").innerHTML = `
        <div class="final-score">
            <h2>🏁 Quiz Finished!</h2>
            <p>Your Score: ${state.score}</p>
            <h3>Highscores:</h3>
            <ol>${state.highscores.map(s => `<li>${s}</li>`).join("")}</ol>
            <button onclick="location.reload()">Play Again</button>
        </div>
    `;
}

// ===== INITIALIZE GAME =====
fetchQuestions();
