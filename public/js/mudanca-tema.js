
const gif = document.getElementById('img-Logo');
const imagem = document.getElementById('imagem-main');

window.mudancaTema = function () {
    const html = document.documentElement;
    const temaAtual = html.getAttribute('data-theme');
    const novoTema = temaAtual === 'dark' ? 'light' : 'dark';

    gif.src = novoTema === 'dark' ? 'img/logo-dark.gif' : 'img/logo.gif';

    if (imagem) {
        imagem.src = novoTema === 'dark' ? 'img/logo-dark.png' : 'img/logo.png';
    }

    html.setAttribute('data-theme', novoTema);
    localStorage.setItem('theme', novoTema);
    mudandoButtonEmoji(novoTema);
}

function mudandoButtonEmoji(theme) {
    const button = document.getElementById('theme-toggle-button');
    if (button) {
        button.innerHTML = theme === 'dark' ? '☀️' : '🌙';
        button.title = theme === 'dark' ? 'Mudar para o modo claro' : 'Mudar para o modo escuro';
    }
}

function criandoButton() {
    const button = document.createElement('button');
    button.id = 'theme-toggle-button';
    button.setAttribute('onclick', 'mudancaTema()');

    const initialTheme = localStorage.getItem('theme') || 'light';
    mudandoButtonEmoji(initialTheme);

    document.body.appendChild(button);
}

function inserirCss() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/dark-mode.css'; // Caminho relativo ao index.html
    document.head.appendChild(link);
}

function carregarTemaSalvo() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme && savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (gif) {
            gif.src = 'img/logo-dark.gif';
        }
        if (imagem) {
            imagem.src = 'img/logo-dark.png';
        }
    } else {
        // Garante que o atributo não está presente se for 'light'
        document.documentElement.removeAttribute('data-theme');
    }
}

function inicializar() {
    // 1. Carregar tema salvo
    carregarTemaSalvo();

    // 2. Injeta CSS
    inserirCss();

    // 3. Cria e injeta o botão
    criandoButton();
}

// Executar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    inicializar();
});

window.addEventListener('load', () => {
    const temaAtual = document.documentElement.getAttribute('data-theme') || 'light';
    mudandoButtonEmoji(temaAtual);
});