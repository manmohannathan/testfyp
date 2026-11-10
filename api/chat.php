<?php
declare(strict_types=1);
require __DIR__.'/guide.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function respond(int $status, array $data): never {
    http_response_code($status); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit;
}
// Optional config lives OUTSIDE htdocs / the public web root, never in GitHub.
$settings=[];
$configPath=getenv('LABUAN_AI_CONFIG');
if ($configPath && is_file($configPath)) {
    $loaded=require $configPath;
    if (is_array($loaded)) $settings=$loaded;
}
$setting=static fn(string $name, string $default=''): string => (string)($settings[$name] ?? (getenv($name) ?: $default));
$origin=$_SERVER['HTTP_ORIGIN'] ?? '';
$scheme=(!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$sameOrigin=$scheme.'://'.($_SERVER['HTTP_HOST'] ?? 'localhost');
$allowedOrigin=$setting('LABUAN_ALLOWED_ORIGIN');
if ($origin === '' || !($origin === $sameOrigin || ($allowedOrigin !== '' && $origin === $allowedOrigin))) respond(403,['code'=>'origin_denied']);
header('Access-Control-Allow-Origin: '.$origin);
header('Vary: Origin');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
$method=$_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {http_response_code(204);exit;}
if ($method !== 'POST') respond(405,['code'=>'method_not_allowed']);
if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''),'application/json')) respond(415,['code'=>'json_required']);
$raw=file_get_contents('php://input',false,null,0,50001);
if ($raw === false || strlen($raw)>50000) respond(413,['code'=>'request_too_large']);
$data=json_decode($raw,true);
if (!is_array($data)) respond(400,['code'=>'invalid_json']);
$knowledge=json_decode(file_get_contents(__DIR__.'/knowledge.json'),true);
if (!is_array($knowledge)) respond(503,['code'=>'unavailable']);
try {$request=guide_input($data,$knowledge);} catch (InvalidArgumentException $e) {respond(400,['code'=>$e->getMessage()]);}
$key=$setting('OPENAI_API_KEY');
if ($key === '') respond(503,['code'=>'not_configured']);
if (!function_exists('curl_init')) respond(503,['code'=>'unavailable']);
// File-locked per-IP and shared daily quotas. No questions or answers are logged.
$quotaFile=rtrim(sys_get_temp_dir(),'/\\').DIRECTORY_SEPARATOR.'labuan-ai-'.substr(hash('sha256',__DIR__),0,16).'.json';
$handle=fopen($quotaFile,'c+');
if (!$handle || !flock($handle,LOCK_EX)) respond(503,['code'=>'unavailable']);
$quota=json_decode(stream_get_contents($handle),true) ?: [];
$today=gmdate('Y-m-d');$now=time();$ip=hash('sha256',$_SERVER['REMOTE_ADDR'] ?? 'unknown');
if (($quota['date'] ?? '') !== $today) $quota=['date'=>$today,'count'=>0,'ips'=>[]];
foreach ($quota['ips'] as $hash=>$entry) if ($now-$entry['start']>=600) unset($quota['ips'][$hash]);
$entry=$quota['ips'][$ip] ?? ['start'=>$now,'count'=>0];
$daily=max(1,min(5000,(int)$setting('LABUAN_DAILY_LIMIT','100')));
$limited=$quota['count'] >= $daily || $entry['count'] >= 12;
if (!$limited) { $entry['count']++;$quota['ips'][$ip]=$entry;$quota['count']++;rewind($handle);ftruncate($handle,0);fwrite($handle,json_encode($quota));fflush($handle); }
flock($handle,LOCK_UN);fclose($handle);
if ($limited) {header('Retry-After: 600');respond(429,['code'=>'rate_limit']);}
$payload=guide_payload($request,$knowledge[$request['id']],$setting('OPENAI_MODEL','gpt-5.4-mini'),$setting('LABUAN_WEB_SEARCH','1') !== '0');
$curl=curl_init('https://api.openai.com/v1/responses');
curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$key],CURLOPT_POSTFIELDS=>json_encode($payload),CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>50,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2]);
$body=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);curl_close($curl);
if ($body === false || $status<200 || $status>=300) respond(502,['code'=>'provider_unavailable']);
$result=json_decode($body,true);
if (!is_array($result) || ($result['status'] ?? '') !== 'completed') respond(502,['code'=>'incomplete_response']);
$parts=guide_parts($result);
if (!$parts) respond(502,['code'=>'empty_response']);
respond(200,['parts'=>$parts]);
