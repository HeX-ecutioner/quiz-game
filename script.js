// ===== GLOBAL STATE =====
const state = {
    questions: [],
    currentIndex: 0,
    score: 0,
    selectedOption: null,
    timer: null,
    isSubmitting: false, // Prevents double submission glitches
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
        
        if (data.response_code !== 0) {
            throw new Error(`API issues, response code: ${data.response_code}`);
        }

        state.questions = data.results.map(q => ({
            category: q.category, // Keep pre-encoded
            question: q.question, // Keep pre-encoded to prevent rendering glitches
            correct: q.correct_answer,
            options: shuffleArray([...q.incorrect_answers, q.correct_answer]),
            difficulty: q.difficulty
        }));

        if (state.questions.length === 0) {
            throw new Error("Zero questions returned by the API.");
        }

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
    
    // Render the pre-encoded option directly, the browser auto-decodes it safely!
    const optionsHTML = q.options.map((opt, i) =>
        `<button class="option-btn" data-index="${i}">${opt}</button>`
    ).join("");

    // Inject logic into persistent content area (no full-screen repaint or gif flash!)
    document.getElementById("quiz-content").innerHTML = `
        <div class="question-meta">
            <span class="category">${q.category}</span>
            <img src="images/${q.difficulty}.jpg" class="difficulty" alt="${q.difficulty} difficulty">
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

    // Add option click listeners
    document.querySelectorAll(".option-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            state.selectedOption = btn.textContent;
            document.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            
            // Unlock the submit button once selection is made!
            const submitBtn = document.getElementById("submit-btn");
            if (submitBtn) submitBtn.disabled = false;
        });
    });

    // Add submit button listener
    const submitBtn = document.getElementById("submit-btn");
    if (submitBtn) {
        submitBtn.addEventListener("click", () => handleSubmit(false));
    }

    startTimer();
}

// ===== HANDLE SUBMIT =====
function handleSubmit(timeout) {
    // Race-condition safeguard
    if (state.isSubmitting) return;
    state.isSubmitting = true;

    clearInterval(state.timer);
    const q = state.questions[state.currentIndex];
    const feedbackEl = document.getElementById("feedback");
    const correctAnswer = decodeHTML(q.correct);
    
    let message = "";
    let isCorrect = false;

    if (timeout) {
        message = `⏳ Time's up! Correct answer: ${correctAnswer}`;
    } else if (state.selectedOption === correctAnswer) {
        isCorrect = true;
        message = `✅ Correct!`;
        state.score += getScoreByDifficulty(q.difficulty);
    } else {
        message = `❌ Wrong! Correct answer: ${correctAnswer}`;
    }

    feedbackEl.textContent = message;
    feedbackEl.classList.remove("correct", "wrong");
    feedbackEl.classList.add(isCorrect ? "correct" : "wrong");

    // Disable user input completely during delay period
    const submitBtn = document.getElementById("submit-btn");
    if (submitBtn) submitBtn.disabled = true;
    document.querySelectorAll(".option-btn").forEach(b => b.disabled = true);

    // Visual feedback
    highlightCorrectAnswer();
    
    // Colorize the user's selection as red if they chose wrong
    document.querySelectorAll(".option-btn").forEach(btn => {
        if (btn.classList.contains("selected") && btn.textContent !== correctAnswer) {
            btn.classList.add("wrong-answer");
        }
    });

    // Move to next question after 2 seconds
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

    document.getElementById("quiz-content").innerHTML = `
        <div class="final-score">
            <h2>🏁 Quiz Finished!</h2>
            <p style="margin: 15px 0; font-size: 1.2rem; font-weight:bold;">Your Score: ${state.score}</p>
            <h3>Highscores:</h3>
            <ol style="margin-bottom:20px;">${state.highscores.map(s => `<li>${s}</li>`).join("")}</ol>
            <button class="submit-btn" style="width: 100%; display:block;" onclick="location.reload()">Play Again</button>
        </div>
    `;
}

// ===== INITIALIZE GAME =====
fetchQuestions();
