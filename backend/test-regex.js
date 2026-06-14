const html = '<script type="module" crossorigin src="/assets/index-CQzuxwgQ.js"></script>';
const base = '/app/yames-7b6qva82/';
const rewritten = html.replace(/(src|href|action)="\//g, `$1="${base}`);
console.log(rewritten);
