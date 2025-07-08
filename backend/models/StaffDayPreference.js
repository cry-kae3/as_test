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
            set(value) {
                if (typeof value === 'string') {
                    this.setDataValue('available', value === 'true' || value === '1');
                } else {
                    this.setDataValue('available', Boolean(value));
                }
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
                if (preference.preferred_start_time === '') preference.preferred_start_time = null;
                if (preference.preferred_end_time === '') preference.preferred_end_time = null;
                if (preference.break_start_time === '') preference.break_start_time = null;
                if (preference.break_end_time === '') preference.break_end_time = null;

                console.log(`[beforeCreate] StaffDayPreference - staff_id: ${preference.staff_id}, day_of_week: ${preference.day_of_week}, available: ${preference.available} (${typeof preference.available})`);
            },
            beforeUpdate: (preference, options) => {
                if (preference.preferred_start_time === '') preference.preferred_start_time = null;
                if (preference.preferred_end_time === '') preference.preferred_end_time = null;
                if (preference.break_start_time === '') preference.break_start_time = null;
                if (preference.break_end_time === '') preference.break_end_time = null;

                console.log(`[beforeUpdate] StaffDayPreference - staff_id: ${preference.staff_id}, day_of_week: ${preference.day_of_week}, available: ${preference.available} (${typeof preference.available})`);
            }
        },
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

    StaffDayPreference.prototype.isAvailableOnDay = function () {
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