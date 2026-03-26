const THRESHOLD = 75;

function parseAllFilesCoverage(rawText) {
    const text = String(rawText || '');
    const allFilesLine = text.split(/\r?\n/).find((line) => /^\s*all files\b/i.test(line));
    if (!allFilesLine) {
        return null;
    }

    const percentages = allFilesLine.match(/\d+(?:\.\d+)?/g) || [];
    if (percentages.length >= 4) {
        return {
            branches: Number(percentages[1]),
            functions: Number(percentages[2]),
            lines: Number(percentages[3])
        };
    }

    if (percentages.length >= 3) {
        return {
            lines: Number(percentages[0]),
            branches: Number(percentages[1]),
            functions: Number(percentages[2])
        };
    }

    return null;
}

function findThresholdViolations(summary) {
    const violations = [];
    if (!summary || Number.isNaN(summary.lines) || Number.isNaN(summary.branches) || Number.isNaN(summary.functions)) {
        return ['lines', 'branches', 'functions'];
    }

    if (summary.lines < THRESHOLD) {
        violations.push('lines');
    }
    if (summary.branches < THRESHOLD) {
        violations.push('branches');
    }
    if (summary.functions < THRESHOLD) {
        violations.push('functions');
    }
    return violations;
}

function formatThresholdFailure(violations, summary) {
    return violations.map((metric) => {
        const actual = summary && typeof summary[metric] === 'number' ? summary[metric].toFixed(2).replace(/\.00$/, '.00') : 'NaN';
        return `NODE_COVERAGE_THRESHOLD_FAILED metric=${metric} required=${THRESHOLD} actual=${actual}`;
    }).join('\n');
}

function checkCoverageText(rawText) {
    const summary = parseAllFilesCoverage(rawText);
    if (!summary) {
        process.stderr.write('NODE_COVERAGE_PARSE_FAILED reason=all_files_row_missing\n');
        return 1;
    }

    const violations = findThresholdViolations(summary);
    if (violations.length > 0) {
        process.stderr.write(`${formatThresholdFailure(violations, summary)}\n`);
        return 1;
    }

    return 0;
}

async function main() {
    let input = '';
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) {
        input += chunk;
    }
    return checkCoverageText(input);
}

module.exports = {
    parseAllFilesCoverage,
    findThresholdViolations,
    formatThresholdFailure,
    checkCoverageText,
    THRESHOLD
};

if (require.main === module) {
    main()
        .then((code) => {
            process.exitCode = code;
        })
        .catch((error) => {
            process.stderr.write(`${error && error.stack ? error.stack : String(error)}\n`);
            process.exitCode = 1;
        });
}
