import { JobScore, JobListing } from '../types';

export function generateScoringReportHTML(job: JobListing, score: JobScore): string {
  const scoreColor = score.overallScore >= 70 ? '#22c55e' : score.overallScore >= 40 ? '#f59e0b' : '#ef4444';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Job Scoring Report - ${job.title}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f9fafb;
      padding: 20px;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 32px;
    }

    .header h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .header .company {
      font-size: 20px;
      opacity: 0.9;
      margin-bottom: 16px;
    }

    .header .meta {
      display: flex;
      gap: 24px;
      font-size: 14px;
      opacity: 0.8;
      flex-wrap: wrap;
    }

    .overall-score {
      text-align: center;
      padding: 32px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }

    .score-circle {
      width: 120px;
      height: 120px;
      margin: 0 auto 16px;
      border-radius: 50%;
      border: 8px solid ${scoreColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      font-weight: 700;
      color: ${scoreColor};
      background: white;
    }

    .score-label {
      font-size: 14px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
    }

    .rationale {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 16px 20px;
      margin: 24px 32px;
      border-radius: 4px;
      font-size: 15px;
      line-height: 1.8;
    }

    .section {
      padding: 32px;
      border-bottom: 1px solid #e5e7eb;
    }

    .section:last-child {
      border-bottom: none;
    }

    .section h2 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 20px;
      color: #111827;
    }

    .breakdown-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
    }

    .score-card {
      background: #f9fafb;
      border-radius: 8px;
      padding: 16px;
      border: 1px solid #e5e7eb;
    }

    .score-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .score-card-title {
      font-size: 14px;
      font-weight: 600;
      color: #6b7280;
      text-transform: capitalize;
    }

    .score-card-value {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
    }

    .score-bar {
      height: 6px;
      background: #e5e7eb;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .score-bar-fill {
      height: 100%;
      transition: width 0.3s ease;
    }

    .score-card-explanation {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.5;
    }

    .strategic-question {
      margin-bottom: 24px;
    }

    .strategic-question:last-child {
      margin-bottom: 0;
    }

    .question-title {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 8px;
    }

    .question-answer {
      font-size: 14px;
      color: #4b5563;
      line-height: 1.7;
      padding: 12px 16px;
      background: #f9fafb;
      border-left: 3px solid #667eea;
      border-radius: 4px;
    }

    .footer {
      padding: 24px 32px;
      background: #f9fafb;
      text-align: center;
      font-size: 13px;
      color: #9ca3af;
    }

    .timestamp {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 8px;
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }

      .container {
        box-shadow: none;
      }

      .score-circle {
        border-width: 6px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(job.title)}</h1>
      <div class="company">${escapeHtml(job.company)}</div>
      <div class="meta">
        <span>📍 ${escapeHtml(job.location || 'Location not specified')}</span>
        ${job.salary ? `<span>💰 $${job.salary.min?.toLocaleString()} - $${job.salary.max?.toLocaleString()}</span>` : ''}
        <span>🆔 ${score.jobId}</span>
      </div>
    </div>

    <div class="overall-score">
      <div class="score-circle">${score.overallScore}%</div>
      <div class="score-label">Overall Match Score</div>
    </div>

    <div class="rationale">${escapeHtml(score.rationale)}</div>

    <div class="section">
      <h2>📊 Score Breakdown</h2>
      <div class="breakdown-grid">
        ${generateScoreCard('Required Skills', score.breakdown.required_skills, score.explanations.required_skills)}
        ${generateScoreCard('Preferred Skills', score.breakdown.preferred_skills, score.explanations.preferred_skills)}
        ${generateScoreCard('Experience Level', score.breakdown.experience_level, score.explanations.experience_level)}
        ${generateScoreCard('Salary Match', score.breakdown.salary, score.explanations.salary)}
        ${generateScoreCard('Location', score.breakdown.location, score.explanations.location)}
        ${generateScoreCard('Company Match', score.breakdown.company_match, score.explanations.company_match)}
      </div>
    </div>

    <div class="section">
      <h2>🎯 Strategic Analysis</h2>

      <div class="strategic-question">
        <div class="question-title">What problem do they think they're trying to solve?</div>
        <div class="question-answer">${escapeHtml(score.strategic_analysis.problem_solving)}</div>
      </div>

      <div class="strategic-question">
        <div class="question-title">What archetype are they probably hiring for?</div>
        <div class="question-answer">${escapeHtml(score.strategic_analysis.hiring_archetype)}</div>
      </div>

      <div class="strategic-question">
        <div class="question-title">Where am I differentiated or even misaligned?</div>
        <div class="question-answer">${escapeHtml(score.strategic_analysis.differentiation)}</div>
      </div>
    </div>

    <div class="footer">
      <div>Generated by Career Catalyst</div>
      <div class="timestamp">Report generated: ${new Date(score.timestamp).toLocaleString()}</div>
    </div>
  </div>

  <script>
    // Print shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        window.print();
      }
    });
  </script>
</body>
</html>
  `;
}

function generateScoreCard(title: string, score: number, explanation: string): string {
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';

  return `
    <div class="score-card">
      <div class="score-card-header">
        <div class="score-card-title">${escapeHtml(title.replace(/_/g, ' '))}</div>
        <div class="score-card-value">${score}%</div>
      </div>
      <div class="score-bar">
        <div class="score-bar-fill" style="width: ${score}%; background: ${color};"></div>
      </div>
      <div class="score-card-explanation">${escapeHtml(explanation)}</div>
    </div>
  `;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
