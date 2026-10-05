const BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api/v1`;

let latestToken: string | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
    try {
        let storedRole = null;
        try {
            storedRole = localStorage.getItem("app_role");
        } catch (e) {
            console.warn("Could not access localStorage", e);
        }
        const refreshEndpoint = storedRole === "STUDENT" ? "/student/refresh" : "/auth/refresh";

        const refreshRes = await fetch(`${BASE_URL}${refreshEndpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: "{}"
        });

        if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const newToken = refreshData?.data?.accessToken || refreshData?.data?.token || refreshData?.accessToken || refreshData?.token;
            if (newToken) {
                console.log("Token refreshed successfully.");
                latestToken = newToken;

                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.has('token')) urlParams.set('token', newToken);
                if (urlParams.has('accesstoken')) urlParams.set('accesstoken', newToken);
                const newUrl = window.location.pathname + '?' + urlParams.toString();
                window.history.replaceState(null, '', newUrl);

                return newToken;
            }
        } else {
            console.error("Token refresh failed with status", refreshRes.status);
        }
    } catch (err) {
        console.error("Error during token refresh", err);
    }
    return null;
};

const apiFetch = async (url: string, options: RequestInit = {}, initialToken: string | null) => {
    if (!latestToken && initialToken) {
        latestToken = initialToken;
    }

    const currentToken = latestToken || initialToken;
    const fetchOptions = { ...options };
    if (currentToken) {
        fetchOptions.headers = { ...(fetchOptions.headers || {}), Authorization: `Bearer ${currentToken}` };
    }

    let res = await fetch(url, fetchOptions);

    if (res.status === 401) {
        console.warn("401 Unauthorized encountered. Attempting to refresh token...");
        const newToken = await refreshAccessToken();
        if (newToken) {
            fetchOptions.headers = { ...(fetchOptions.headers || {}), Authorization: `Bearer ${newToken}` };
            res = await fetch(url, fetchOptions);
        }
    }
    
    return res;
};

export const getGameQuestions = async (gameId: number, lessonId: string | null, _token: string | null) => {
    const token = await refreshAccessToken();
    if (!token) {
        console.warn("Could not retrieve initial access token in getGameQuestions");
    }

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const url = lessonId
        ? `${BASE_URL}/student/games/${gameId}/questions?lessonId=${lessonId}`
        : `${BASE_URL}/student/games/${gameId}/questions`;

    const response = await apiFetch(url, { headers }, token);
    return response.json();
}

export const startGameSession = async (gameId: number, lessonId: string | null, token: string | null) => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const url = lessonId
        ? `${BASE_URL}/student/games/${gameId}/sessions?lessonId=${lessonId}`
        : `${BASE_URL}/student/games/${gameId}/sessions`;

    const response = await apiFetch(url, { method: 'POST', headers }, token);
    return response.json();
}

export const submitGameAnswers = async (sessionId: string | number, answers: any[], token: string | null) => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const response = await apiFetch(`${BASE_URL}/student/games/sessions/${sessionId}/submit-answers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ answers })
    }, token);
    return response.json();
};

export const completeGameSession = async (sessionId: string | number, token: string | null) => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const response = await apiFetch(`${BASE_URL}/student/games/sessions/${sessionId}/complete`, {
        method: 'POST',
        headers,
    }, token);
    return response.json();
};
