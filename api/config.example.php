<?php
// Copy OUTSIDE the public web root, e.g. C:/Manmohan Safe/labuan-ai-config.php.
// Add the key ONLY to that private copy. This template is safe to commit empty.
return [
    'OPENAI_API_KEY' => '',
    'OPENAI_MODEL' => 'gpt-5.4-mini',
    'LABUAN_ALLOWED_ORIGIN' => '', // Live site origin only, e.g. https://yourname.github.io (no repository path).
    'LABUAN_WEB_SEARCH' => '1',
    'LABUAN_DAILY_LIMIT' => '100', // Total requests per UTC day on this single server.
];
