const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');

const register = async (req, res) => {
    try {
        const { username, password, email, company_name, role, parent_user_id } = req.body;

        if (!username || !password || !email || !role) {
            return res.status(400).json({ message: 'すべての必須フィールドを入力してください' });
        }

        if (role === 'staff' && !parent_user_id) {
            return res.status(400).json({ message: 'スタッフの場合、親ユーザー（オーナー）の指定は必須です' });
        }

        const existingUser = await User.findOne({
            where: {
                username
            }
        });

        if (existingUser) {
            return res.status(400).json({ message: 'このユーザー名は既に使用されています' });
        }

        const existingEmail = await User.findOne({
            where: {
                email
            }
        });

        if (existingEmail) {
            return res.status(400).json({ message: 'このメールアドレスは既に使用されています' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let userRole = role;
        if (role === 'manager' || role === 'customer') {
            userRole = 'owner';
        }

        const user = await User.create({
            username,
            password: hashedPassword,
            email,
            company_name,
            role: userRole,
            parent_user_id: parent_user_id || null
        });

        const { password: _, ...userWithoutPassword } = user.get({ plain: true });

        res.status(201).json(userWithoutPassword);
    } catch (error) {
        console.error('ユーザー登録エラー:', error);
        res.status(500).json({ message: 'ユーザー登録中にエラーが発生しました' });
    }
};

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, password, company_name, role, parent_user_id } = req.body;

        if (req.user.id.toString() === id && req.user.role === 'admin' && role !== 'admin') {
            return res.status(400).json({ message: '自分自身の管理者権限を削除することはできません' });
        }

        if (role === 'staff' && !parent_user_id) {
            return res.status(400).json({ message: 'スタッフの場合、親ユーザー（オーナー）の指定は必須です' });
        }

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ message: 'ユーザーが見つかりません' });
        }

        const updates = { username, email, company_name };

        if (role) {
            let userRole = role;
            if (role === 'manager' || role === 'customer') {
                userRole = 'owner';
            }
            updates.role = userRole;
        }

        if (parent_user_id !== undefined) {
            updates.parent_user_id = parent_user_id;
        }

        if (password) {
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(password, salt);
        }

        await user.update(updates);

        const { password: _, ...userWithoutPassword } = user.get({ plain: true });

        res.status(200).json(userWithoutPassword);
    } catch (error) {
        console.error('ユーザー更新エラー:', error);
        res.status(500).json({ message: 'ユーザーの更新中にエラーが発生しました' });
    }
};

const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        console.log('ログイン試行:', { username });

        if (!username || !password) {
            return res.status(400).json({ message: 'ユーザー名とパスワードは必須です' });
        }

        const user = await User.findOne({
            where: { username }
        });

        if (!user) {
            console.log('ユーザーが見つかりません:', username);
            return res.status(401).json({ message: 'ユーザー名またはパスワードが正しくありません' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            console.log('パスワードが正しくありません:', username);
            return res.status(401).json({ message: 'ユーザー名またはパスワードが正しくありません' });
        }

        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET環境変数が設定されていません');
            return res.status(500).json({ message: 'サーバー設定エラー' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        const userWithoutPassword = { ...user.toJSON() };
        delete userWithoutPassword.password;

        console.log('ログイン成功:', { id: user.id, username: user.username });

        res.status(200).json({
            token,
            user: userWithoutPassword
        });
    } catch (error) {
        console.error('ログインエラー:', error);
        res.status(500).json({ message: 'ログイン処理中にエラーが発生しました', error: error.message });
    }
};

const getCurrentUser = async (req, res) => {
    try {
        const { password: _, ...userWithoutPassword } = req.user.get({ plain: true });

        res.status(200).json(userWithoutPassword);
    } catch (error) {
        console.error('ユーザー情報取得エラー:', error);
        res.status(500).json({ message: 'ユーザー情報の取得中にエラーが発生しました' });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: { exclude: ['password'] },
            include: [
                {
                    model: User,
                    as: 'parent',
                    attributes: ['id', 'username'],
                    required: false
                }
            ]
        });

        const formattedUsers = users.map(user => {
            const userData = user.toJSON();
            if (userData.role === 'manager') {
                userData.roleName = 'カスタマー';
            } else if (userData.role === 'admin') {
                userData.roleName = '管理者';
            } else {
                userData.roleName = userData.role;
            }

            if (userData.parent) {
                userData.parent_user_name = userData.parent.username;
            }

            return userData;
        });

        res.status(200).json(formattedUsers);
    } catch (error) {
        console.error('ユーザーリスト取得エラー:', error);
        res.status(500).json({ message: 'ユーザーリストの取得中にエラーが発生しました' });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.id.toString() === id) {
            return res.status(400).json({ message: '自分自身を削除することはできません' });
        }

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ message: 'ユーザーが見つかりません' });
        }

        await user.destroy();
        res.status(200).json({ message: 'ユーザーが削除されました' });
    } catch (error) {
        console.error('ユーザー削除エラー:', error);
        res.status(500).json({ message: 'ユーザーの削除中にエラーが発生しました' });
    }
};

module.exports = {
    register,
    login,
    getCurrentUser,
    getAllUsers,
    updateUser,
    deleteUser
};