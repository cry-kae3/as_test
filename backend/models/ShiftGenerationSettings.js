module.exports = (sequelize, DataTypes) => {
    const ShiftGenerationSettings = sequelize.define('ShiftGenerationSettings', {
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
        min_staff_per_shift: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 1
        },
        max_shift_length_hours: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 8
        },
        min_rest_hours_between_shifts: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 10
        },
        prioritize_staff_preferences: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        distribute_hours_fairly: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        additional_parameters: {
            type: DataTypes.JSONB,
            allowNull: true
        }
    }, {
        tableName: 'shift_generation_settings',
        timestamps: true
    });

    return ShiftGenerationSettings;
};