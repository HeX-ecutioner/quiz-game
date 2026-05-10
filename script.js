const state = { // Global state to store quiz data
    questions: [],
    currentIndex: 0,
    score: 0,
    selectedOption: null,
    timer: null,
    isSubmitting: false, // Prevents double submission glitches
    timePerQuestion: 15, // seconds per question
    highscores: JSON.parse(localStorage.getItem("highscores") || "[]")
};

function decodeHTML(html) { // Utility function to decode HTML entities
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

async function fetchQuestions() {
    try {
        const res = await fetch("https://opentdb.com/api.php?amount=50"), data = await res.json();

        if (data.response_code !== 0) throw new Error(`API issues, response code: ${data.response_code}`);
        state.questions = data.results.map(q => ({
            category: q.category, // Keep pre-encoded
            question: q.question, // Keep pre-encoded to prevent rendering glitches
            correct: q.correct_answer,
            options: shuffleArray([...q.incorrect_answers, q.correct_answer]),
            difficulty: q.difficulty
        }));

        if (state.questions.length === 0) throw new Error("Zero questions returned by the API.");

        renderQuestion();
    } catch (e) {
        console.error("Failed to fetch questions:", e);
        document.getElementById("quiz-content").innerHTML = `
            <div style="text-align: center; color: #ff4d4d; padding: 20px;">
                <p>Error loading questions! Check connection.</p>
                <button onclick="location.reload()" style="margin-top:10px; padding:8px 16px; cursor:pointer; border:none; border-radius:5px; background:#2cb65a; color:#fff;">Retry</button>
            </div>`;
    }
}

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

function renderQuestion() {
    clearInterval(state.timer);
    state.selectedOption = null;
    const q = state.questions[state.currentIndex];

    // Render the pre-encoded option directly, the browser auto-decodes it safely!
    const optionsHTML = q.options.map((opt, i) =>
        `<button class="option-btn" data-index="${i}">${opt}</button>`
    ).join("");

    // Inject logic into persistent content area (no full-screen repaint or gif flash!)
    document.getElementById("quiz-content").innerHTML = `
        <div class="question-meta">
            <span class="category">${q.category}</span>
            <span class="difficulty-badge diff-${q.difficulty}">${q.difficulty}</span>
        </div>
        <h2 class="question-text">${q.question}</h2>
        <div id="options" class="options-grid">
            ${optionsHTML}
        </div>
        <div id="feedback" class="feedback"></div>
        <div class="controls">
            <div id="timer" class="timer">⏱ ${state.timePerQuestion}s</div>
            <button id="submit-btn" class="submit-btn" disabled>Submit</button>
        </div>
        <div class="progress-bar">
            <div class="progress" style="width: ${((state.currentIndex) / state.questions.length) * 100}%"></div>
        </div>
    `;

    document.querySelectorAll(".option-btn").forEach(btn => { // Add option click listeners
        btn.addEventListener("click", () => {
            state.selectedOption = btn.textContent;
            document.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");

            const submitBtn = document.getElementById("submit-btn"); // Unlock the submit button once selection is made!
            if (submitBtn) submitBtn.disabled = false;
        });
    });

    const submitBtn = document.getElementById("submit-btn"); // Add submit button listener
    if (submitBtn) submitBtn.addEventListener("click", () => handleSubmit(false));
    startTimer();
}

function handleSubmit(timeout) {
    if (state.isSubmitting) return; // Race-condition safeguard
    state.isSubmitting = true;

    clearInterval(state.timer);
    const q = state.questions[state.currentIndex];
    const feedbackEl = document.getElementById("feedback");
    const correctAnswer = decodeHTML(q.correct);

    let message = "", isCorrect = false;

    if (timeout) message = `⏳ Time's up! Correct answer: ${correctAnswer}`;
    else if (state.selectedOption === correctAnswer) {
        isCorrect = true;
        message = `✅ Correct!`;
        state.score += getScoreByDifficulty(q.difficulty);
    } else message = `❌ Wrong! Correct answer: ${correctAnswer}`;

    feedbackEl.textContent = message;
    feedbackEl.classList.remove("correct", "wrong");
    feedbackEl.classList.add(isCorrect ? "correct" : "wrong");

    const submitBtn = document.getElementById("submit-btn");
    if (submitBtn) submitBtn.disabled = true; // Disable user input completely during delay period
    document.querySelectorAll(".option-btn").forEach(b => b.disabled = true);

    highlightCorrectAnswer(); // Visual feedback

    document.querySelectorAll(".option-btn").forEach(btn => { // Colorize the user's selection as red if they chose wrong
        if (btn.classList.contains("selected") && btn.textContent !== correctAnswer) btn.classList.add("wrong-answer");
    });

    setTimeout(() => {
        state.isSubmitting = false; // Clear block for next lifecycle
        state.currentIndex++;
        if (state.currentIndex >= state.questions.length) {
            renderFinalScore();
        } else {
            renderQuestion();
        }
    }, 2000);
}

function highlightCorrectAnswer() {
    const q = state.questions[state.currentIndex];
    const correctAnswer = decodeHTML(q.correct);
    document.querySelectorAll(".option-btn").forEach(btn => {
        if (btn.textContent === correctAnswer) btn.classList.add("correct-answer");
    });
}

function getScoreByDifficulty(diff) {
    switch (diff) {
        case "easy": return 10;
        case "medium": return 20;
        case "hard": return 30;
        default: return 0;
    }
}

function renderFinalScore() {
    state.highscores.push(state.score);
    state.highscores.sort((a, b) => b - a);
    if (state.highscores.length > 10) state.highscores.pop();
    localStorage.setItem("highscores", JSON.stringify(state.highscores));

    document.getElementById("quiz-content").innerHTML = `
        <div class="final-score">
            <h2>🏁 Quiz Finished!</h2>
            <p>Your Score: <strong>${state.score}</strong></p>
            <h3>Highscores</h3>
            <ol>${state.highscores.map(s => `<li>${s}</li>`).join("")}</ol>
            <button class="submit-btn" style="width: 100%; margin-top: 15px;" onclick="location.reload()">Play Again</button>
        </div>
    `;
}

fetchQuestions(); // Initialize Game