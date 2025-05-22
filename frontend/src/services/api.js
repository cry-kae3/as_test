import axios from 'axios';

// ブラウザ環境では相対パスを使用し、サーバーサイドレンダリング時は環境変数を使用
const baseURL = typeof window !== 'undefined'
    ? '/api'  // 開発環境ではVue CLIのプロキシが処理
    : process.env.VUE_APP_API_URL;

// デバッグ情報
if (process.env.NODE_ENV === 'development') {
    console.log('API baseURL:', baseURL);
    console.log('VUE_APP_API_URL:', process.env.VUE_APP_API_URL);
}

// APIクライアントの作成
const api = axios.create({
    baseURL: baseURL,
    headers: {
        'Content-Type': 'application/json'
    },
    // タイムアウト設定を追加
    timeout: 10000
});

// リクエストインターセプターの追加
api.interceptors.request.use(
    config => {
        // 毎回リクエスト時にトークンを取得して設定
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        if (process.env.NODE_ENV === 'development') {
            console.log('API Request:', config.method.toUpperCase(), config.url);
        }

        return config;
    },
    error => {
        console.error('リクエストエラー:', error);
        return Promise.reject(error);
    }
);

// レスポンスインターセプター
api.interceptors.response.use(
    response => {
        if (process.env.NODE_ENV === 'development') {
            console.log('API Response:', response.status, response.config.url);
        }
        return response;
    },
    error => {
        // エラー情報を詳細にログ出力
        console.error('APIエラー:', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
        });

        // 認証エラー（401）の場合、ログイン画面にリダイレクト
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export default api;