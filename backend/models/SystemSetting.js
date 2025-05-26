module.exports = (sequelize, DataTypes) => {
    const SystemSetting = sequelize.define('SystemSetting', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        closing_day: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 25,
            validate: {
                min: 1,
                max: 31
            }
        },
        timezone: {
            type: DataTypes.STRING(50),
            allowNull: true,
            defaultValue: 'Asia/Tokyo'
        },
        additional_settings: {
            type: DataTypes.JSONB,
            allowNull: true
        }
    }, {
        tableName: 'system_settings',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['user_id']
            }
        ]
    });

    return SystemSetting;
};