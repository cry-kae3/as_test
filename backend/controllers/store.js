const { sequelize, Store, StoreClosedDay, StoreStaffRequirement, BusinessHours, User } = require('../models');
const { Op } = require('sequelize');

exports.getAllStores = async (req, res) => {
    try {
        let whereClause = {};

        console.log('getAllStores - ユーザー情報:', {
            userId: req.user.id,
            userRole: req.user.role,
            isImpersonating: req.isImpersonating,
            originalUser: req.originalUser?.id
        });

        if (req.isImpersonating && req.originalUser && req.originalUser.role === 'admin') {
            if (req.user.role === 'owner' || req.user.role === 'manager') {
                let ownerId = req.user.id;
                whereClause.owner_id = ownerId;
                console.log('なりすましモード - オーナー権限でフィルタリング適用 - owner_id:', ownerId);
            } else if (req.user.role === 'staff' && req.user.parent_user_id) {
                let ownerId = req.user.parent_user_id;
                whereClause.owner_id = ownerId;
                console.log('なりすましモード - スタッフ権限でフィルタリング適用 - owner_id:', ownerId);
            }
        } else if (req.user.role === 'owner' || req.user.role === 'manager') {
            let ownerId = req.user.id;
            whereClause.owner_id = ownerId;
            console.log('通常モード - オーナー権限でフィルタリング適用 - owner_id:', ownerId);
        } else if (req.user.role === 'staff' && req.user.parent_user_id) {
            let ownerId = req.user.parent_user_id;
            whereClause.owner_id = ownerId;
            console.log('通常モード - スタッフ権限でフィルタリング適用 - owner_id:', ownerId);
        }

        console.log('最終的なwhereClause:', whereClause);

        const stores = await Store.findAll({
            where: whereClause,
            attributes: [
                'id',
                'name',
                'address',
                'phone',
                'email',
                'opening_time',
                'closing_time',
                'owner_id',
                'area',
                'postal_code',
                'createdAt',
                'updatedAt'
            ]
        });

        console.log('取得した店舗数:', stores.length);

        res.status(200).json(stores);
    } catch (error) {
        console.error('店舗一覧取得エラー:', error);
        res.status(500).json({ message: '店舗一覧の取得中にエラーが発生しました' });
    }
};

exports.getStoreById = async (req, res) => {
    try {
        const { id } = req.params;

        let whereClause = { id };

        if (req.isImpersonating && req.originalUser && req.originalUser.role === 'admin') {
            if (req.user.role === 'owner' || req.user.role === 'manager') {
                whereClause.owner_id = req.user.id;
            } else if (req.user.role === 'staff' && req.user.parent_user_id) {
                whereClause.owner_id = req.user.parent_user_id;
            }
        } else if (req.user.role === 'owner' || req.user.role === 'manager') {
            whereClause.owner_id = req.user.id;
        } else if (req.user.role === 'staff' && req.user.parent_user_id) {
            whereClause.owner_id = req.user.parent_user_id;
        }

        const store = await Store.findOne({
            where: whereClause,
            attributes: [
                'id',
                'name',
                'address',
                'phone',
                'email',
                'opening_time',
                'closing_time',
                'owner_id',
                'area',
                'postal_code',
                'createdAt',
                'updatedAt'
            ],
            include: [
                { model: StoreClosedDay, as: 'closedDays' },
                { model: StoreStaffRequirement, as: 'staffRequirements' }
            ]
        });

        if (!store) {
            return res.status(404).json({ message: '店舗が見つかりません' });
        }

        res.status(200).json(store);
    } catch (error) {
        console.error('店舗取得エラー:', error);
        res.status(500).json({ message: '店舗情報の取得中にエラーが発生しました' });
    }
};

exports.getStoreClosedDays = async (req, res) => {
    try {
        const { id } = req.params;

        let storeWhereClause = { id };

        if (req.isImpersonating && req.originalUser && req.originalUser.role === 'admin') {
            if (req.user.role === 'owner' || req.user.role === 'manager') {
                storeWhereClause.owner_id = req.user.id;
            } else if (req.user.role === 'staff' && req.user.parent_user_id) {
                storeWhereClause.owner_id = req.user.parent_user_id;
            }
        } else if (req.user.role === 'owner' || req.user.role === 'manager') {
            storeWhereClause.owner_id = req.user.id;
        } else if (req.user.role === 'staff' && req.user.parent_user_id) {
            storeWhereClause.owner_id = req.user.parent_user_id;
        }

        const store = await Store.findOne({
            where: storeWhereClause,
            attributes: [
                'id',
                'name',
                'address',
                'phone',
                'email',
                'opening_time',
                'closing_time',
                'owner_id',
                'area',
                'postal_code',
                'createdAt',
                'updatedAt'
            ]
        });

        if (!store) {
            return res.status(404).json({ message: '店舗が見つかりません' });
        }

        const closedDays = await StoreClosedDay.findAll({
            where: { store_id: id }
        });

        res.status(200).json(closedDays);
    } catch (error) {
        console.error('定休日取得エラー:', error);
        res.status(500).json({ message: '定休日情報の取得中にエラーが発生しました' });
    }
};

exports.getStoreStaffRequirements = async (req, res) => {
    try {
        const { id } = req.params;

        let storeWhereClause = { id };

        if (req.isImpersonating && req.originalUser && req.originalUser.role === 'admin') {
            if (req.user.role === 'owner' || req.user.role === 'manager') {
                storeWhereClause.owner_id = req.user.id;
            } else if (req.user.role === 'staff' && req.user.parent_user_id) {
                storeWhereClause.owner_id = req.user.parent_user_id;
            }
        } else if (req.user.role === 'owner' || req.user.role === 'manager') {
            storeWhereClause.owner_id = req.user.id;
        } else if (req.user.role === 'staff' && req.user.parent_user_id) {
            storeWhereClause.owner_id = req.user.parent_user_id;
        }

        const store = await Store.findOne({
            where: storeWhereClause,
            attributes: [
                'id',
                'name',
                'address',
                'phone',
                'email',
                'opening_time',
                'closing_time',
                'owner_id',
                'area',
                'postal_code',
                'createdAt',
                'updatedAt'
            ]
        });

        if (!store) {
            return res.status(404).json({ message: '店舗が見つかりません' });
        }

        const staffRequirements = await StoreStaffRequirement.findAll({
            where: { store_id: id }
        });

        res.status(200).json(staffRequirements);
    } catch (error) {
        console.error('スタッフ要件取得エラー:', error);
        res.status(500).json({ message: 'スタッフ要件の取得中にエラーが発生しました' });
    }
};

exports.createStore = async (req, res) => {
    try {
        const {
            name,
            address,
            phone,
            email,
            opening_time,
            closing_time,
            closed_days,
            staff_requirements,
            area,
            postal_code
        } = req.body;

        if (!name || !opening_time || !closing_time) {
            return res.status(400).json({ message: '店舗名、営業開始時間、営業終了時間は必須です' });
        }

        let ownerId = req.user.id;

        if (req.isImpersonating && req.originalUser && req.originalUser.role === 'admin') {
            if (req.user.role === 'owner' || req.user.role === 'manager') {
                ownerId = req.user.id;
            } else if (req.user.role === 'staff' && req.user.parent_user_id) {
                ownerId = req.user.parent_user_id;
            }
        } else if (req.user.role === 'staff' && req.user.parent_user_id) {
            ownerId = req.user.parent_user_id;
        }

        const existingStore = await Store.findOne({
            where: sequelize.where(
                sequelize.fn('LOWER', sequelize.col('name')),
                sequelize.fn('LOWER', name.trim())
            )
        });

        if (existingStore) {
            return res.status(400).json({ message: '同じ名前の店舗が既に存在します' });
        }

        console.log('店舗作成 - owner_id設定:', ownerId);

        const result = await sequelize.transaction(async (t) => {
            const store = await Store.create({
                name: name.trim(),
                address,
                phone,
                email,
                opening_time,
                closing_time,
                owner_id: ownerId,
                area,
                postal_code
            }, { transaction: t });

            if (closed_days && closed_days.length > 0) {
                await StoreClosedDay.bulkCreate(
                    closed_days.map(day => ({
                        store_id: store.id,
                        day_of_week: day.day_of_week,
                        specific_date: day.specific_date
                    })),
                    { transaction: t }
                );
            }

            if (staff_requirements && staff_requirements.length > 0) {
                await StoreStaffRequirement.bulkCreate(
                    staff_requirements.map(req => ({
                        store_id: store.id,
                        day_of_week: req.day_of_week,
                        specific_date: req.specific_date,
                        start_time: req.start_time,
                        end_time: req.end_time,
                        required_staff_count: req.required_staff_count
                    })),
                    { transaction: t }
                );
            }

            return store;
        });

        const createdStore = await Store.findByPk(result.id, {
            attributes: [
                'id',
                'name',
                'address',
                'phone',
                'email',
                'opening_time',
                'closing_time',
                'owner_id',
                'area',
                'postal_code',
                'createdAt',
                'updatedAt'
            ],
            include: [
                { model: StoreClosedDay, as: 'closedDays' },
                { model: StoreStaffRequirement, as: 'staffRequirements' }
            ]
        });

        res.status(201).json(createdStore);
    } catch (error) {
        console.error('店舗作成の詳細エラー:', error.name, error.message, error.stack);

        if (error.errors) {
            console.error('バリデーションエラー:');
            error.errors.forEach(err => console.error(`- ${err.path}: ${err.message}`));
        }

        if (error.original) {
            console.error('SQLエラー詳細:', error.original);
        }

        res.status(500).json({
            message: '店舗の作成中にエラーが発生しました',
            error: error.message,
            name: error.name,
            details: error.errors ? error.errors.map(e => ({ field: e.path, message: e.message })) : undefined
        });
    }
};

exports.updateStore = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            address,
            phone,
            email,
            opening_time,
            closing_time,
            closed_days,
            staff_requirements,
            area,
            postal_code
        } = req.body;

        let whereClause = { id };

        if (req.isImpersonating && req.originalUser && req.originalUser.role === 'admin') {
            if (req.user.role === 'owner' || req.user.role === 'manager') {
                whereClause.owner_id = req.user.id;
            } else if (req.user.role === 'staff' && req.user.parent_user_id) {
                whereClause.owner_id = req.user.parent_user_id;
            }
        } else if (req.user.role === 'owner' || req.user.role === 'manager') {
            whereClause.owner_id = req.user.id;
        } else if (req.user.role === 'staff' && req.user.parent_user_id) {
            whereClause.owner_id = req.user.parent_user_id;
        }

        const store = await Store.findOne({ where: whereClause });

        if (!store) {
            return res.status(404).json({ message: '店舗が見つかりません' });
        }

        if (name && name.trim()) {
            const existingStore = await Store.findOne({
                where: {
                    [Op.and]: [
                        sequelize.where(
                            sequelize.fn('LOWER', sequelize.col('name')),
                            sequelize.fn('LOWER', name.trim())
                        ),
                        { id: { [Op.ne]: id } }
                    ]
                }
            });

            if (existingStore) {
                return res.status(400).json({ message: '同じ名前の店舗が既に存在します' });
            }
        }

        await sequelize.transaction(async (t) => {
            await store.update({
                name: name ? name.trim() : store.name,
                address: address !== undefined ? address : store.address,
                phone: phone !== undefined ? phone : store.phone,
                email: email !== undefined ? email : store.email,
                opening_time: opening_time || store.opening_time,
                closing_time: closing_time || store.closing_time,
                area: area !== undefined ? area : store.area,
                postal_code: postal_code !== undefined ? postal_code : store.postal_code
            }, { transaction: t });

            if (closed_days !== undefined) {
                await StoreClosedDay.destroy({
                    where: { store_id: id },
                    transaction: t
                });

                if (closed_days && closed_days.length > 0) {
                    await StoreClosedDay.bulkCreate(
                        closed_days.map(day => ({
                            store_id: id,
                            day_of_week: day.day_of_week,
                            specific_date: day.specific_date
                        })),
                        { transaction: t }
                    );
                }
            }

            if (staff_requirements !== undefined) {
                await StoreStaffRequirement.destroy({
                    where: { store_id: id },
                    transaction: t
                });

                if (staff_requirements && staff_requirements.length > 0) {
                    await StoreStaffRequirement.bulkCreate(
                        staff_requirements.map(req => ({
                            store_id: id,
                            day_of_week: req.day_of_week,
                            specific_date: req.specific_date,
                            start_time: req.start_time,
                            end_time: req.end_time,
                            required_staff_count: req.required_staff_count
                        })),
                        { transaction: t }
                    );
                }
            }
        });

        const updatedStore = await Store.findByPk(id, {
            attributes: [
                'id',
                'name',
                'address',
                'phone',
                'email',
                'opening_time',
                'closing_time',
                'owner_id',
                'area',
                'postal_code',
                'createdAt',
                'updatedAt'
            ],
            include: [
                { model: StoreClosedDay, as: 'closedDays' },
                { model: StoreStaffRequirement, as: 'staffRequirements' }
            ]
        });

        res.status(200).json(updatedStore);
    } catch (error) {
        console.error('店舗更新エラー:', error);
        res.status(500).json({ message: '店舗情報の更新中にエラーが発生しました' });
    }
};

exports.deleteStore = async (req, res) => {
    try {
        const { id } = req.params;

        let whereClause = { id };

        if (req.isImpersonating && req.originalUser && req.originalUser.role === 'admin') {
            if (req.user.role === 'owner' || req.user.role === 'manager') {
                whereClause.owner_id = req.user.id;
            } else if (req.user.role === 'staff' && req.user.parent_user_id) {
                whereClause.owner_id = req.user.parent_user_id;
            }
        } else if (req.user.role === 'owner' || req.user.role === 'manager') {
            whereClause.owner_id = req.user.id;
        } else if (req.user.role === 'staff' && req.user.parent_user_id) {
            whereClause.owner_id = req.user.parent_user_id;
        }

        const store = await Store.findOne({ where: whereClause });

        if (!store) {
            return res.status(404).json({ message: '店舗が見つかりません' });
        }

        await store.destroy();

        res.status(200).json({ message: '店舗が削除されました' });
    } catch (error) {
        console.error('店舗削除エラー:', error);
        res.status(500).json({ message: '店舗の削除中にエラーが発生しました' });
    }
};

exports.getBusinessHours = async (req, res) => {
    try {
        const { id } = req.params;

        let storeWhereClause = { id };

        if (req.isImpersonating && req.originalUser && req.originalUser.role === 'admin') {
            if (req.user.role === 'owner' || req.user.role === 'manager') {
                storeWhereClause.owner_id = req.user.id;
            } else if (req.user.role === 'staff' && req.user.parent_user_id) {
                storeWhereClause.owner_id = req.user.parent_user_id;
            }
        } else if (req.user.role === 'owner' || req.user.role === 'manager') {
            storeWhereClause.owner_id = req.user.id;
        } else if (req.user.role === 'staff' && req.user.parent_user_id) {
            storeWhereClause.owner_id = req.user.parent_user_id;
        }

        const store = await Store.findOne({
            where: storeWhereClause,
            attributes: [
                'id',
                'name',
                'address',
                'phone',
                'email',
                'opening_time',
                'closing_time',
                'owner_id',
                'area',
                'postal_code',
                'createdAt',
                'updatedAt'
            ]
        });

        if (!store) {
            return res.status(404).json({ message: '店舗が見つかりません' });
        }

        const businessHours = await BusinessHours.findAll({
            where: { store_id: id },
            order: [['day_of_week', 'ASC']]
        });

        return res.status(200).json(businessHours);
    } catch (error) {
        console.error('営業時間取得エラー:', error);
        return res.status(500).json({
            message: '営業時間の取得に失敗しました',
            error: error.message
        });
    }
};

exports.saveBusinessHours = async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();

        const storeId = req.params.id || req.params.storeId;

        if (!storeId || storeId === 'null' || storeId === 'undefined') {
            return res.status(400).json({
                message: '店舗IDが指定されていません'
            });
        }

        const storeIdNum = parseInt(storeId, 10);

        if (isNaN(storeIdNum)) {
            return res.status(400).json({
                message: '無効な店舗ID形式です'
            });
        }

        let storeWhereClause = { id: storeIdNum };

        if (req.isImpersonating && req.originalUser && req.originalUser.role === 'admin') {
            if (req.user.role === 'owner' || req.user.role === 'manager') {
                storeWhereClause.owner_id = req.user.id;
            } else if (req.user.role === 'staff' && req.user.parent_user_id) {
                storeWhereClause.owner_id = req.user.parent_user_id;
            }
        } else if (req.user.role === 'owner' || req.user.role === 'manager') {
            storeWhereClause.owner_id = req.user.id;
        } else if (req.user.role === 'staff' && req.user.parent_user_id) {
            storeWhereClause.owner_id = req.user.parent_user_id;
        }

        const store = await Store.findOne({
            where: storeWhereClause,
            attributes: [
                'id',
                'name',
                'address',
                'phone',
                'email',
                'opening_time',
                'closing_time',
                'owner_id',
                'area',
                'postal_code',
                'createdAt',
                'updatedAt'
            ],
            transaction
        });

        if (!store) {
            return res.status(404).json({
                message: '店舗が見つかりません'
            });
        }

        const businessHoursData = req.body;

        await BusinessHours.destroy({
            where: { store_id: storeIdNum },
            transaction
        });

        let savedBusinessHours = [];
        if (businessHoursData && businessHoursData.length > 0) {
            const processedData = businessHoursData.map(hour => ({
                store_id: storeIdNum,
                day_of_week: hour.day_of_week,
                is_closed: hour.is_closed,
                opening_time: hour.opening_time,
                closing_time: hour.closing_time
            }));

            savedBusinessHours = await BusinessHours.bulkCreate(processedData, { transaction });
        }

        await transaction.commit();
        return res.status(200).json({
            message: '営業時間が保存されました',
            data: savedBusinessHours
        });
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('営業時間保存エラー:', error);
        return res.status(500).json({
            message: '営業時間の保存に失敗しました',
            error: error.message
        });
    }
}

exports.saveClosedDays = async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { id } = req.params;
        const closedDaysData = req.body;

        let storeWhereClause = { id };

        if (req.isImpersonating && req.originalUser && req.originalUser.role === 'admin') {
            if (req.user.role === 'owner' || req.user.role === 'manager') {
                storeWhereClause.owner_id = req.user.id;
            } else if (req.user.role === 'staff' && req.user.parent_user_id) {
                storeWhereClause.owner_id = req.user.parent_user_id;
            }
        } else if (req.user.role === 'owner' || req.user.role === 'manager') {
            storeWhereClause.owner_id = req.user.id;
        } else if (req.user.role === 'staff' && req.user.parent_user_id) {
            storeWhereClause.owner_id = req.user.parent_user_id;
        }

        const store = await Store.findOne({
            where: storeWhereClause,
            attributes: [
                'id',
                'name',
                'address',
                'phone',
                'email',
                'opening_time',
                'closing_time',
                'owner_id',
                'area',
                'postal_code',
                'createdAt',
                'updatedAt'
            ],
            transaction
        });

        if (!store) {
            return res.status(404).json({
                message: '店舗が見つかりません'
            });
        }

        console.log('定休日保存開始:', { storeId: id, data: closedDaysData });

        await StoreClosedDay.destroy({
            where: { store_id: id },
            transaction
        });

        let savedClosedDays = [];
        if (closedDaysData && closedDaysData.length > 0) {
            const processedData = closedDaysData.map(day => {
                return {
                    store_id: parseInt(id, 10),
                    day_of_week: day.day_of_week !== undefined ? day.day_of_week : null,
                    specific_date: day.specific_date || null
                };
            });

            console.log('処理済み定休日データ:', processedData);

            savedClosedDays = await StoreClosedDay.bulkCreate(processedData, { transaction });
        }

        await transaction.commit();
        return res.status(200).json({
            message: '定休日が保存されました',
            data: savedClosedDays
        });
    } catch (error) {
        console.error('定休日保存処理エラー:', error);
        if (transaction) await transaction.rollback();
        return res.status(500).json({
            message: '定休日の保存に失敗しました',
            error: error.message,
            stack: error.stack
        });
    }
};

exports.saveStaffRequirements = async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { id } = req.params;
        const requirementsData = req.body;

        let storeWhereClause = { id };

        if (req.isImpersonating && req.originalUser && req.originalUser.role === 'admin') {
            if (req.user.role === 'owner' || req.user.role === 'manager') {
                storeWhereClause.owner_id = req.user.id;
            } else if (req.user.role === 'staff' && req.user.parent_user_id) {
                storeWhereClause.owner_id = req.user.parent_user_id;
            }
        } else if (req.user.role === 'owner' || req.user.role === 'manager') {
            storeWhereClause.owner_id = req.user.id;
        } else if (req.user.role === 'staff' && req.user.parent_user_id) {
            storeWhereClause.owner_id = req.user.parent_user_id;
        }

        const store = await Store.findOne({
            where: storeWhereClause,
            attributes: [
                'id',
                'name',
                'address',
                'phone',
                'email',
                'opening_time',
                'closing_time',
                'owner_id',
                'area',
                'postal_code',
                'createdAt',
                'updatedAt'
            ],
            transaction
        });

        if (!store) {
            return res.status(404).json({
                message: '店舗が見つかりません'
            });
        }

        console.log('人員要件保存開始:', { storeId: id, data: requirementsData });

        await StoreStaffRequirement.destroy({
            where: { store_id: id },
            transaction
        });

        let savedRequirements = [];
        if (requirementsData && requirementsData.length > 0) {
            const processedData = requirementsData.map(req => {
                return {
                    store_id: parseInt(id, 10),
                    day_of_week: req.day_of_week !== undefined ? parseInt(req.day_of_week, 10) : null,
                    specific_date: req.specific_date || null,
                    start_time: req.start_time,
                    end_time: req.end_time,
                    required_staff_count: parseInt(req.required_staff_count, 10)
                };
            });

            console.log('処理済み人員要件データ:', processedData);

            savedRequirements = await StoreStaffRequirement.bulkCreate(processedData, { transaction });
        }

        await transaction.commit();
        return res.status(200).json({
            message: '人員要件が保存されました',
            data: savedRequirements
        });
    } catch (error) {
        console.error('人員要件保存処理エラー:', error);
        if (transaction) await transaction.rollback();
        return res.status(500).json({
            message: '人員要件の保存に失敗しました',
            error: error.message,
            stack: error.stack
        });
    }
};

exports.deleteAllStaffRequirements = async (req, res) => {
    try {
        const { id } = req.params;

        let storeWhereClause = { id };

        if (req.isImpersonating && req.originalUser && req.originalUser.role === 'admin') {
            if (req.user.role === 'owner' || req.user.role === 'manager') {
                storeWhereClause.owner_id = req.user.id;
            } else if (req.user.role === 'staff' && req.user.parent_user_id) {
                storeWhereClause.owner_id = req.user.parent_user_id;
            }
        } else if (req.user.role === 'owner' || req.user.role === 'manager') {
            storeWhereClause.owner_id = req.user.id;
        } else if (req.user.role === 'staff' && req.user.parent_user_id) {
            storeWhereClause.owner_id = req.user.parent_user_id;
        }

        const store = await Store.findOne({
            where: storeWhereClause,
            attributes: [
                'id',
                'name',
                'address',
                'phone',
                'email',
                'opening_time',
                'closing_time',
                'owner_id',
                'area',
                'postal_code',
                'createdAt',
                'updatedAt'
            ]
        });

        if (!store) {
            return res.status(404).json({
                message: '店舗が見つかりません'
            });
        }

        await StoreStaffRequirement.destroy({
            where: { store_id: id }
        });
        return res.status(200).json({
            message: '人員要件が削除されました'
        });
    } catch (error) {
        return res.status(500).json({
            message: '人員要件の削除に失敗しました',
            error: error.message
        });
    }
};

exports.deleteAllClosedDays = async (req, res) => {
    try {
        const { id } = req.params;

        let storeWhereClause = { id };

        if (req.isImpersonating && req.originalUser && req.originalUser.role === 'admin') {
            if (req.user.role === 'owner' || req.user.role === 'manager') {
                storeWhereClause.owner_id = req.user.id;
            } else if (req.user.role === 'staff' && req.user.parent_user_id) {
                storeWhereClause.owner_id = req.user.parent_user_id;
            }
        } else if (req.user.role === 'owner' || req.user.role === 'manager') {
            storeWhereClause.owner_id = req.user.id;
        } else if (req.user.role === 'staff' && req.user.parent_user_id) {
            storeWhereClause.owner_id = req.user.parent_user_id;
        }

        const store = await Store.findOne({
            where: storeWhereClause,
            attributes: [
                'id',
                'name',
                'address',
                'phone',
                'email',
                'opening_time',
                'closing_time',
                'owner_id',
                'area',
                'postal_code',
                'createdAt',
                'updatedAt'
            ]
        });

        if (!store) {
            return res.status(404).json({
                message: '店舗が見つかりません'
            });
        }

        await StoreClosedDay.destroy({
            where: { store_id: id }
        });
        return res.status(200).json({
            message: '定休日が削除されました'
        });
    } catch (error) {
        return res.status(500).json({
            message: '定休日の削除に失敗しました',
            error: error.message
        });
    }
};