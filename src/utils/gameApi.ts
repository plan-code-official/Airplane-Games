const BASE_URL = 'https://learning-platform-1euu.onrender.com/api/v1';

export const getGameQuestions = async (gameId: number, lessonId: string | null, token: string | null) => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = lessonId
        ? `${BASE_URL}/student/games/${gameId}/questions?lessonId=${lessonId}`
        : `${BASE_URL}/student/games/${gameId}/questions`;

    const response = await fetch(url, { headers });
    return response.json();
}

export const startGameSession = async (gameId: number, lessonId: string | null, token: string | null) => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = lessonId
        ? `${BASE_URL}/student/games/${gameId}/sessions?lessonId=${lessonId}`
        : `${BASE_URL}/student/games/${gameId}/sessions`;

    const response = await fetch(url, { method: 'POST', headers });
    return response.json();
}

export const submitGameAnswers = async (sessionId: string | number, answers: any[], token: string | null) => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/student/games/sessions/${sessionId}/submit-answers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ answers })
    });

    return response.json();
};

export const completeGameSession = async (sessionId: string | number, token: string | null) => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/student/games/sessions/${sessionId}/complete`, {
        method: 'POST',
        headers,
    });

    return response.json();
};
