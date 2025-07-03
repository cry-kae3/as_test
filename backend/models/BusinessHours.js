module.exports = (sequelize, DataTypes) => {
    const BusinessHours = sequelize.define('BusinessHours', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        store_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'stores',
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
        is_closed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        opening_time: {
            type: DataTypes.TIME,
            allowNull: true
        },
        closing_time: {
            type: DataTypes.TIME,
            allowNull: true
        }
    }, {
        tableName: 'business_hours',
        timestamps: true
    });

    return BusinessHours;
};