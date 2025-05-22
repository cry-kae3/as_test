module.exports = (sequelize, DataTypes) => {
    const StoreClosedDay = sequelize.define('StoreClosedDay', {
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
            allowNull: true,
            validate: {
                min: 0,
                max: 6
            }
        },
        specific_date: {
            type: DataTypes.DATEONLY,
            allowNull: true
        }
    }, {
        tableName: 'store_closed_days',
        timestamps: true,
        validate: {
            eitherDayOfWeekOrSpecificDate() {
                if ((this.day_of_week === null && this.specific_date === null) ||
                    (this.day_of_week !== null && this.specific_date !== null)) {
                    throw new Error('Either day_of_week or specific_date must be specified, but not both');
                }
            }
        }
    });

    return StoreClosedDay;
  };