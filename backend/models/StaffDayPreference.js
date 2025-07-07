module.exports = (sequelize, DataTypes) => {
    const StaffDayPreference = sequelize.define('StaffDayPreference', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        staff_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'staff',
                key: 'id'
            }
        },
        day_of_week: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 0,
                max: 6
            }
        },
        available: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            // 🔥 新規追加: getterでBoolean型を保証
            get() {
                const rawValue = this.getDataValue('available');
                // データベースから取得時に文字列として取得される場合の対処
                if (typeof rawValue === 'string') {
                    return rawValue === 'true' || rawValue === '1';
                }
                return Boolean(rawValue);
            },
            // 🔥 新規追加: setterでBoolean型を保証
            set(value) {
                // 設定時にもBoolean型に正規化
                let normalizedValue;
                if (value === null || value === undefined) {
                    normalizedValue = false;
                } else if (typeof value === 'string') {
                    normalizedValue = value === 'true' || value === '1';
                } else {
                    normalizedValue = Boolean(value);
                }
                this.setDataValue('available', normalizedValue);
            }
        },
        preferred_start_time: {
            type: DataTypes.TIME,
            allowNull: true
        },
        preferred_end_time: {
            type: DataTypes.TIME,
            allowNull: true
        },
        break_start_time: {
            type: DataTypes.TIME,
            allowNull: true
        },
        break_end_time: {
            type: DataTypes.TIME,
            allowNull: true
        }
    }, {
        tableName: 'staff_day_preferences',
        timestamps: true,
        hooks: {
            beforeCreate: (preference, options) => {
                // 空文字列をnullに変換
                if (preference.preferred_start_time === '') preference.preferred_start_time = null;
                if (preference.preferred_end_time === '') preference.preferred_end_time = null;
                if (preference.break_start_time === '') preference.break_start_time = null;
                if (preference.break_end_time === '') preference.break_end_time = null;

                // 🔥 強化: Boolean型に強制変換（多様な入力値に対応）
                let normalizedAvailable;
                if (preference.available === null || preference.available === undefined) {
                    normalizedAvailable = false;
                } else if (typeof preference.available === 'string') {
                    const stringValue = preference.available.toLowerCase().trim();
                    normalizedAvailable = stringValue === 'true' || stringValue === '1' || stringValue === 'yes';
                } else if (typeof preference.available === 'number') {
                    normalizedAvailable = preference.available !== 0;
                } else {
                    normalizedAvailable = Boolean(preference.available);
                }
                preference.available = normalizedAvailable;

                console.log(`[beforeCreate] StaffDayPreference - staff_id: ${preference.staff_id}, day_of_week: ${preference.day_of_week}, available: ${preference.available} (${typeof preference.available})`);
            },
            beforeUpdate: (preference, options) => {
                // 空文字列をnullに変換
                if (preference.preferred_start_time === '') preference.preferred_start_time = null;
                if (preference.preferred_end_time === '') preference.preferred_end_time = null;
                if (preference.break_start_time === '') preference.break_start_time = null;
                if (preference.break_end_time === '') preference.break_end_time = null;

                // 🔥 強化: Boolean型に強制変換（多様な入力値に対応）
                let normalizedAvailable;
                if (preference.available === null || preference.available === undefined) {
                    normalizedAvailable = false;
                } else if (typeof preference.available === 'string') {
                    const stringValue = preference.available.toLowerCase().trim();
                    normalizedAvailable = stringValue === 'true' || stringValue === '1' || stringValue === 'yes';
                } else if (typeof preference.available === 'number') {
                    normalizedAvailable = preference.available !== 0;
                } else {
                    normalizedAvailable = Boolean(preference.available);
                }
                preference.available = normalizedAvailable;

                console.log(`[beforeUpdate] StaffDayPreference - staff_id: ${preference.staff_id}, day_of_week: ${preference.day_of_week}, available: ${preference.available} (${typeof preference.available})`);
            },
            afterFind: (result, options) => {
                // 🔥 新規追加: データベースから取得後の正規化処理
                if (result) {
                    const processPreference = (preference) => {
                        if (preference && preference.available !== undefined) {
                            const originalValue = preference.available;
                            const originalType = typeof originalValue;

                            // Boolean型に正規化
                            let normalizedValue;
                            if (originalValue === null || originalValue === undefined) {
                                normalizedValue = false;
                            } else if (typeof originalValue === 'string') {
                                const stringValue = originalValue.toLowerCase().trim();
                                normalizedValue = stringValue === 'true' || stringValue === '1' || stringValue === 'yes';
                            } else if (typeof originalValue === 'number') {
                                normalizedValue = originalValue !== 0;
                            } else {
                                normalizedValue = Boolean(originalValue);
                            }

                            preference.available = normalizedValue;

                            console.log(`[afterFind] StaffDayPreference - staff_id: ${preference.staff_id}, day_of_week: ${preference.day_of_week}, available: ${originalValue} (${originalType}) → ${normalizedValue} (${typeof normalizedValue})`);
                        }
                    };

                    if (Array.isArray(result)) {
                        result.forEach(processPreference);
                    } else {
                        processPreference(result);
                    }
                }
            }
        },
        // 🔥 新規追加: インデックスの追加（パフォーマンス向上）
        indexes: [
            {
                fields: ['staff_id', 'day_of_week'],
                unique: true
            },
            {
                fields: ['staff_id']
            },
            {
                fields: ['day_of_week']
            },
            {
                fields: ['available']
            }
        ]
    });

    // 🔥 新規追加: インスタンスメソッドの追加
    StaffDayPreference.prototype.isAvailableOnDay = function () {
        // Boolean型を保証するメソッド
        return Boolean(this.available);
    };

    StaffDayPreference.prototype.getDayName = function () {
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        return dayNames[this.day_of_week] || '不明';
    };

    StaffDayPreference.prototype.getWorkTimeRange = function () {
        if (!this.isAvailableOnDay()) {
            return null;
        }
        return {
            start: this.preferred_start_time,
            end: this.preferred_end_time
        };
    };

    // 🔥 新規追加: クラスメソッドの追加
    StaffDayPreference.getAvailableStaffByDay = async function (dayOfWeek, storeId = null) {
        const whereClause = {
            day_of_week: dayOfWeek,
            available: true
        };

        const includeClause = [{
            model: sequelize.models.Staff,
            as: 'staff',
            required: true
        }];

        if (storeId) {
            includeClause[0].where = { store_id: storeId };
        }

        return await this.findAll({
            where: whereClause,
            include: includeClause
        });
    };

    StaffDayPreference.normalizeAvailableField = function (value) {
        // 静的メソッドとしてBoolean正規化ロジックを提供
        if (value === null || value === undefined) {
            return false;
        } else if (typeof value === 'string') {
            const stringValue = value.toLowerCase().trim();
            return stringValue === 'true' || stringValue === '1' || stringValue === 'yes';
        } else if (typeof value === 'number') {
            return value !== 0;
        } else {
            return Boolean(value);
        }
    };

    return StaffDayPreference;
};