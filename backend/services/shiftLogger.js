const fs = require('fs');
const path = require('path');

class ShiftLogger {
    constructor() {
        this.logDir = path.join(__dirname, '../logs');
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    getLogFileName(storeId, year, month, type = 'generation') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `shift-${type}-store${storeId}-${year}${month.toString().padStart(2, '0')}-${timestamp}.log`;
    }

    async logShiftGeneration(storeId, year, month, data) {
        const fileName = this.getLogFileName(storeId, year, month, 'generation');
        const filePath = path.join(this.logDir, fileName);

        const logData = {
            timestamp: new Date().toISOString(),
            storeId,
            year,
            month,
            type: 'SHIFT_GENERATION',
            ...data
        };

        const logLine = JSON.stringify(logData, null, 2) + '\n\n';

        try {
            fs.appendFileSync(filePath, logLine, 'utf8');
            console.log(`ログ出力: ${fileName}`);
        } catch (error) {
            console.error('ログ書き込みエラー:', error);
        }
    }

    async logStaffData(storeId, year, month, staffData) {
        await this.logShiftGeneration(storeId, year, month, {
            phase: 'STAFF_DATA_COLLECTION',
            staffCount: staffData ? staffData.length : 0,
            staffDetails: staffData ? staffData.map(staff => ({
                id: staff.id,
                name: staff.name,
                minHours: staff.min_hours_for_this_store,
                maxHours: staff.max_hours_for_this_store,
                otherStoreHours: staff.other_store_hours,
                totalMinHours: staff.min_hours_per_month,
                totalMaxHours: staff.max_hours_per_month,
                dayPreferences: staff.day_preferences && Array.isArray(staff.day_preferences) ?
                    staff.day_preferences.map(pref => ({
                        day: pref.day_name,
                        available: pref.available,
                        startTime: pref.preferred_start_time,
                        endTime: pref.preferred_end_time
                    })) : [],
                daysOff: staff.days_off || [],
                otherStoreShifts: staff.other_store_shifts || []
            })) : []
        });
    }

    async logTimeCalculation(storeId, year, month, calculationData) {
        await this.logShiftGeneration(storeId, year, month, {
            phase: 'TIME_CALCULATION',
            ...calculationData
        });
    }

    async logAIPrompt(storeId, year, month, prompt) {
        await this.logShiftGeneration(storeId, year, month, {
            phase: 'AI_PROMPT_GENERATION',
            promptLength: prompt ? prompt.length : 0,
            prompt: prompt || ''
        });
    }

    async logAIResponse(storeId, year, month, response, parsedData) {
        await this.logShiftGeneration(storeId, year, month, {
            phase: 'AI_RESPONSE_PROCESSING',
            responseLength: response ? response.length : 0,
            response: response || '',
            parsedShifts: parsedData && parsedData.shifts ? parsedData.shifts.length : 0,
            parsedSummary: parsedData ? parsedData.summary : null
        });
    }

    async logValidation(storeId, year, month, validationResult) {
        await this.logShiftGeneration(storeId, year, month, {
            phase: 'SHIFT_VALIDATION',
            isValid: validationResult ? validationResult.isValid : false,
            warnings: validationResult ? validationResult.warnings : [],
            violationCount: validationResult && validationResult.warnings ? validationResult.warnings.length : 0
        });
    }

    async logHoursValidation(storeId, year, month, staffHoursData) {
        await this.logShiftGeneration(storeId, year, month, {
            phase: 'HOURS_VALIDATION',
            staffHours: staffHoursData && Array.isArray(staffHoursData) ?
                staffHoursData.map(staff => ({
                    id: staff.staffId,
                    name: staff.name,
                    generatedHours: staff.generatedHours,
                    minRequired: staff.minRequired,
                    maxAllowed: staff.maxAllowed,
                    otherStoreHours: staff.otherStoreHours,
                    totalHours: staff.totalHours,
                    isUnderMin: staff.generatedHours < staff.minRequired,
                    isOverMax: staff.generatedHours > staff.maxAllowed,
                    isTotalOverMax: staff.totalHours > staff.maxAllowed
                })) : []
        });
    }

    async logError(storeId, year, month, error, phase) {
        await this.logShiftGeneration(storeId, year, month, {
            phase: phase || 'ERROR',
            error: {
                message: error ? error.message : 'Unknown error',
                stack: error ? error.stack : 'No stack trace available',
                name: error ? error.name : 'Unknown error type'
            }
        });
    }
}

module.exports = new ShiftLogger();