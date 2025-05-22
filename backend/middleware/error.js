// エラーハンドリングミドルウェア
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);

    // Sequelizeのバリデーションエラー
    if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
        const errors = err.errors.map(e => ({
            field: e.path,
            message: e.message
        }));
        return res.status(400).json({ errors });
    }

    // JWT認証エラー
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: '認証エラー: ' + err.message });
    }

    // その他のエラー
    const statusCode = err.statusCode || 500;
    const message = err.message || 'サーバーエラーが発生しました';

    res.status(statusCode).json({ message });
};

// 404エラーハンドリング
const notFoundHandler = (req, res, next) => {
    res.status(404).json({ message: 'リソースが見つかりません' });
};

module.exports = {
    errorHandler,
    notFoundHandler
  };