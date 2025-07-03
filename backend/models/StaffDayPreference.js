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
            defaultValue: true
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

                // Boolean型に強制変換
                preference.available = Boolean(preference.available);
            },
            beforeUpdate: (preference, options) => {
                // 空文字列をnullに変換
                if (preference.preferred_start_time === '') preference.preferred_start_time = null;
                if (preference.preferred_end_time === '') preference.preferred_end_time = null;
                if (preference.break_start_time === '') preference.break_start_time = null;
                if (preference.break_end_time === '') preference.break_end_time = null;

                // Boolean型に強制変換
                preference.available = Boolean(preference.available);
            }
        }
    });

    return StaffDayPreference;
};