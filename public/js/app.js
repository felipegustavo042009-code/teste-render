
const EstadoApp = {
    paginaAtual: 'home',
    usuario: null,
    classes: []
};

document.addEventListener('DOMContentLoaded', function () {
    inicializarApp();

    if (!window.location.hash.startsWith('#join/')) {
        navegarPara('home');
    }
});



//Funções basicas
async function inicializarApp() {

    iniciarUsuario();

    configurarEventListeners();

    mostrarCarregamento();
    setTimeout(esconderCarregamento, 3000);
}

async function iniciarUsuario() {
    try {
        const resultado = await window.api.criarUsuario();

        if (resultado && resultado.usuarioId) {
            localStorage.setItem('idUsuario', resultado.usuarioId);
        }
    } catch (error) {
        console.warn('Não foi possível criar usuário automaticamente:', error);
    }
}

function configurarEventListeners() {
    // Fechar modais ao clicar fora
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('modal')) {
            fecharTodosModais();
        }
    });

    // Lidar com tecla Escape e Enter
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            fecharTodosModais();
            fecharTodasSecoes();
        }

        if (e.key === 'Enter') {
            const inputNome = document.getElementById('student-name-input');
            const secaoInputCodigo = document.getElementById('code-input-section');
            if (inputNome) {
                confirmarNomeAluno();
            } else if (secaoInputCodigo && secaoInputCodigo.style.display !== 'none') {
                entrarSalaPorCodigo();
            }
        }
    });

    // Lidar com envios de formulário
    document.addEventListener('submit', function (e) {
        e.preventDefault();
    });
}

function exibirMenu() {
    const menu = document.getElementsByClassName('nav')[0];

    if (menu.classList.contains("show")) {
        menu.classList.toggle('show');
    } else {
        menu.classList.toggle('show');
    }
}

function navegarPara(pagina) {

    if (pagina === 'teacher-panel' && (!window.GerenciadorSala || typeof window.GerenciadorSala !== 'object')) {
        console.error('GerenciadorSala não está disponível');
        showToast('Sistema não inicializado corretamente', 'error');
        return;
    }

    const paginaAntiga = EstadoApp.paginaAtual;

    const botaoSair = document.getElementById("sair");
    const spanTexto = botaoSair.querySelector("span");
    const nav = document.querySelector(".nav");

    if (pagina == "home" && nav.classList.contains("show")) {
        exibirMenu();
    }

    if (pagina != "home") {
        if (pagina == "teacher-panel") {
            window.GerenciadorSala.listarAlunosConectados();
            botaoSair.onclick = encerrarSala;
            spanTexto.textContent = "Desativar";
            botaoSair.style.display = "flex";
        } else {
            botaoSair.onclick = sairSala;
            spanTexto.textContent = "Sair";
            botaoSair.style.display = "none";
        }
    } else {
        botaoSair.style.display = "none";
    }

    EstadoApp.paginaAtual = pagina;

    history.pushState({ pagina }, '', `#${pagina}`);

    carregarConteudoPagina(pagina);
    atualizarEstadoNavegacao(pagina);

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function carregarConteudoPagina(pagina) {
    const conteudoPrincipal = document.getElementById('main-content');

    try {
        mostrarCarregamento();

        await new Promise(resolve => setTimeout(resolve, 300));

        const resposta = await fetch(`pages/${pagina}.html`);

        if (!resposta.ok) {
            throw new Error(`Página não encontrada: ${pagina}`);
        }

        const conteudo = await resposta.text();
        conteudoPrincipal.innerHTML = conteudo;

        // Inicializar funcionalidade específica da página
        inicializarFuncionalidadePagina(pagina);

        esconderCarregamento();

    } catch (error) {
        console.error('Erro ao carregar página:', error);
        conteudoPrincipal.innerHTML = `
            <div class="error-page">
                <div class="container">
                    <div class="error-content">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h1>Página não encontrada</h1>
                        <p>A página que você está procurando não existe.</p>
                        <button class="btn btn-primary" onclick="navegarPara('home')">
                            <i class="fas fa-home"></i> Voltar ao Início
                        </button>
                    </div>
                </div>
            </div>
        `;
        esconderCarregamento();
    }
}

function inicializarFuncionalidadePagina(pagina) {
    switch (pagina) {
        case 'teacher-panel':
            inicializarPainelProfessor();
            break;
        case 'student-room':
            inicializarSalaAluno();
            break;
    }
}

function inicializarSalaAluno() {
    const inicializarAtividadesAluno = setInterval(() => {
        if (window.sistemaAtividades && EstadoSala.codigoSala) {
            clearInterval(inicializarAtividadesAluno);

        }
    }, 500);

    if (window.GerenciadorMaoLevantada) {
        GerenciadorMaoLevantada.inicializar();
    }
}

function atualizarEstadoNavegacao(pagina) {
    // Atualizar itens de navegação ativos se necessário
    const botoesNav = document.querySelectorAll('.nav-btn');
    botoesNav.forEach(btn => {
        btn.classList.remove('active');
    });
}




//Sistema respostas
async function responderComoAluno(idAtividade) {
    const nomeAluno = GerenciadorAluno.nomeAtual || localStorage.getItem('studentName') || 'Aluno';
    const idUsuario = localStorage.getItem('idUsuario');
    const idSala = localStorage.getItem('idSala');

    if (!idAtividade || !idSala || !nomeAluno || !idUsuario) {
        showToast('Dados incompletos', 'error');
        return;
    }

    try {
        const respostas = await window.api.listarRespostas(idUsuario, idSala, idAtividade);
        const jaRespondeu = respostas.some(r => r.studentId === idUsuario);

        if (jaRespondeu) {
            const respostaId = respostas.find(r => r.studentId === idUsuario)?.id;
            
            const confirmar = await mostrarModalGeral(
                `
                <p><strong>Atenção!</strong> Você já respondeu esta atividade.</p>
                <p>Ao cancelar:</p>
                <ul style="text-align: left; margin: 1rem 0; padding-left: 1.5rem;">
                    <li>Seu status voltará para "Pendente"</li>
                    <li>O professor será notificado</li>
                    <li>Você poderá responder novamente depois</li>
                </ul>
                <div class="response-details">
                    <p><strong>Aluno:</strong> ${nomeAluno}</p>
                    <p><strong>Hora do cancelamento:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                </div>
                `,
                'fazer',
                'Enviar Resposta'
            );

            if (!confirmar) {
                return;
            }
            else {
                await confirmarCancelarResposta(idAtividade, nomeAluno, respostaId)
            }
        } else {
            const confirmar = await mostrarModalGeral(
                `<p>Tem certeza que deseja env sua resposta para esta atividade?</p> 
                <div class= "response-details" > 
                    <p><strong>Aluno:</strong> ${nomeAluno}</p> 
                    <p><strong>Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p> 
                </div >`,
                'fazer',
                'Enviar Resposta'
            );

            if (!confirmar) {
                return;
            }
            else {
                confirmarEnvioResposta(idAtividade, idSala, nomeAluno)
            }
        }
    } catch (error) {
        showToast('Erro: ' + error.message, 'error');
    }
}

async function confirmarEnvioResposta(idAtividade, codigoSala, nomeAluno) {

    try {
        mostrarCarregamento();

        const idUsuario = localStorage.getItem('idUsuario');
        const idSala = localStorage.getItem('idSala');

        await window.api.criarResposta(
            idUsuario,
            idSala,
            idAtividade
        );

        esconderCarregamento();

        showToast('Resposta enviada com sucesso para o professor!', 'success');

        // Atualizar a UI para mostrar botão "Cancelar Resposta"
        if (window.sistemaAtividades && typeof window.sistemaAtividades.atualizarUIAluno === 'function') {
            window.sistemaAtividades.atualizarUIAluno().catch(error => console.error('Erro ao atualizar UI do aluno após envio:', error));
        }

    } catch (error) {
        esconderCarregamento();
        console.error('❌ Erro ao enviar resposta:', error);
        showToast('Erro ao enviar resposta. Tente novamente.', 'error');
    }
}

async function confirmarCancelarResposta(idAtividade, nomeAluno, respostaId) {
    try {
        // Mostrar carregando
        mostrarCarregamento();

        const idUsuario = localStorage.getItem('idUsuario');

        await window.api.apagarResposta(idUsuario, respostaId);

        esconderCarregamento();

        showToast('Resposta cancelada com sucesso!', 'success');

        // Atualizar a UI para mostrar botão "Responder" novamente
        if (window.sistemaAtividades && typeof window.sistemaAtividades.atualizarUIAluno === 'function') {
            window.sistemaAtividades.atualizarUIAluno().catch(error => console.error('Erro ao atualizar UI do aluno após cancelamento:', error));
        }

    } catch (error) {
        esconderCarregamento();
        console.error('❌ Erro ao cancelar resposta:', error);
        showToast('Erro ao cancelar resposta. Tente novamente.', 'error');
    }
}
window.confirmarCancelarResposta = confirmarCancelarResposta;
window.confirmarEnvioResposta = confirmarEnvioResposta;





// Funções de modal de fechar e abrir
function fecharTodosModais() {
    const modais = document.querySelectorAll('.modal');
    modais.forEach(modal => {
        modal.classList.remove('active');
        modal.style.display = 'none';
    });
}

function fecharTodasSecoes() {
    const secoes = document.querySelectorAll('.content-section');
    secoes.forEach(secao => {
        secao.style.display = 'none';
    });

    if (EstadoSala) {
        EstadoSala.atividadeAtivaId = null;
        EstadoSala.respostasAtividade = {};
        GerenciadorSala.listarAlunosConectados();
    }
}


function mostrarModalGeral(mensagem, tipo, acao) {
    return new Promise((resolve) => {

        let tipoMensagem, tipoButton, tipoIcone;
        if (tipo === 'fazer') {
            tipoMensagem = '<i class="fas fa-paper-plane" style="font-size: 3rem; color: #0066cc;"></i>';
            tipoButton = 'btn-primary';
            tipoIcone = 'fa-check'
        } else {
            tipoMensagem = '<i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ff6b6b;"></i>';
            tipoButton = 'btn-danger';
            tipoIcone = 'fa-trash';
        }

        const modal = document.createElement('div');
        modal.className = 'modal cancel-confirm-modal';
        modal.style.display = 'flex';
        modal.style.pointerEvents = 'all';
        modal.innerHTML = `
    <div class="confirm-modal-content cancel-modal container-simples">
        <div class="confirm-header cancel-header">
            ${tipoMensagem}
            <h2>${acao}</h2>
        </div>
        <div class="confirm-body cancel-body">
            <p>${mensagem}</p>
        </div>
        <div class="confirm-footer cancel-footer">
            <button class="btn btn-secondary cancelar">
            <i class="fas fa-times"></i> Cancelar
            </button>
            <button class="btn ${tipoButton} confirmar">
            <i class="fas ${tipoIcone}"></i> Confirmar
            </button>
        </div>
    </div>
    `;

        document.body.appendChild(modal);

        modal.querySelector('.cancelar').onclick = () => {
            modal.remove();
            resolve(false);
        };

        modal.querySelector('.confirmar').onclick = () => {
            modal.remove();
            resolve(true);
        };
    });
}




// Adicionar as funções ao escopo globa
window.fecharTodasSecoes = fecharTodasSecoes;
window.mostrarModalGeral = mostrarModalGeral;






// Funções de carregamento
function mostrarCarregamento() {
    const overlayCarregamento = document.getElementById('loading-overlay');
    if (overlayCarregamento) {
        overlayCarregamento.style.display = 'flex';
    }
}

function esconderCarregamento() {
    const overlayCarregamento = document.getElementById('loading-overlay');
    if (overlayCarregamento) {
        overlayCarregamento.style.display = 'none';
    }
}



// Sistema de notificações toast
function showToast(mensagem, tipo = 'success') {
    const containerToast = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;

    const icone = getIconeToast(tipo);
    toast.innerHTML = `
        <i class="${icone}"></i>
        <span>${mensagem}</span>
    `;

    containerToast.appendChild(toast);

    // Remover automaticamente após 3 segundos
    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease-out forwards';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

function getIconeToast(tipo) {
    switch (tipo) {
        case 'success': return 'fas fa-check-circle';
        case 'error': return 'fas fa-exclamation-circle';
        case 'warning': return 'fas fa-exclamation-triangle';
        case 'info': return 'fas fa-info-circle';
        default: return 'fas fa-check-circle';
    }
}




// Funções de Acesso do Aluno
function mostrarAcessoAluno() {
    // Esconder seção hero e mostrar acesso do aluno
    const secaoHero = document.querySelector('.hero-section');
    const secaoRecursos = document.querySelector('.features-section');
    const secaoAcessoAluno = document.getElementById('student-access-section');

    if (secaoHero) secaoHero.style.display = 'none';
    if (secaoRecursos) secaoRecursos.style.display = 'none';
    if (secaoAcessoAluno) secaoAcessoAluno.style.display = 'flex';

    mostrarInputCodigo(); // Ir direto para o input código
}

function esconderAcessoAluno() {
    // Mostrar seção hero e esconder acesso do aluno
    const secaoHero = document.querySelector('.hero-section');
    const secaoRecursos = document.querySelector('.features-section');
    const secaoAcessoAluno = document.getElementById('student-access-section');
    const secaoInputCodigo = document.getElementById('code-input-section');

    if (secaoHero) secaoHero.style.display = 'block';
    if (secaoRecursos) secaoRecursos.style.display = 'block';
    if (secaoAcessoAluno) secaoAcessoAluno.style.display = 'none';
    if (secaoInputCodigo) secaoInputCodigo.style.display = 'none';
}

function mostrarInputCodigo() {
    const secaoAcessoAluno = document.getElementById('student-access-section');
    const secaoInputCodigo = document.getElementById('code-input-section');

    if (secaoAcessoAluno) secaoAcessoAluno.style.display = 'none';
    if (secaoInputCodigo) secaoInputCodigo.style.display = 'flex';

    // Focar no input
    setTimeout(() => {
        const inputCodigo = document.getElementById('room-code-input');
        if (inputCodigo) inputCodigo.focus();
    }, 100);
}

function entrarSalaPorCodigo(codigoSala = null) {
    if (!codigoSala) {
        const inputCodigo = document.getElementById('room-code-input');
        codigoSala = inputCodigo ? inputCodigo.value.trim() : '';
    }

    if (!codigoSala || codigoSala.length !== 6) {
        showToast('Por favor, digite um código de 6 dígitos', 'error');
        return;
    }

    codigoSala = codigoSala.toUpperCase();
    mostrarCarregamento();

    GerenciadorSala.entrarSala(codigoSala)
        .then(sala => {
            esconderCarregamento();
            showToast(`Entrando na sala ${codigoSala}...`, 'success');

            // Limpar input
            const inputCodigo = document.getElementById('room-code-input');
            if (inputCodigo) inputCodigo.value = '';

            // Navegar para sala do aluno
            navegarPara('student-room');
        })
        .catch(error => {
            esconderCarregamento();
            showToast(error, 'error');
        });
}

function confirmarNomeAluno() {
    const inputNome = document.getElementById('student-name-input');
    const nome = inputNome ? inputNome.value.trim() : '';

    var regex = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]{3,}\s[A-Za-zÀ-ÖØ-öø-ÿ\s]{3,}$/;
    if (!regex.test(nome)) {
        showToast("O nome deve contém apenas letras, espaços e duas palavras de 3 caracteres.", 'error');
    }
    else {
        showToast("Nome válido.");
        if (GerenciadorAluno.confirmarNome(nome)) {
            // Limpar input
            if (inputNome) {
                inputNome.value = ''

                const botaoSair = document.getElementById("sair");
                botaoSair.style.display = "flex";

                // tempo de garantia de carregamento do Mão Levantada e as outras coisas
                mostrarCarregamento();
                setTimeout(() => {
                    esconderCarregamento();
                    fecharTodasSecoes();
                }, 2200);
            };
        };
    }
};

window.confirmarNomeAluno = confirmarNomeAluno;
window.mostrarAcessoAluno = mostrarAcessoAluno;
window.esconderAcessoAluno = esconderAcessoAluno;
window.mostrarInputCodigo = mostrarInputCodigo;
window.entrarSalaPorCodigo = entrarSalaPorCodigo;





//Painel do Professor para gerenciar
function inicializarPainelProfessor() {

    // Criar sala automaticamente se não existir
    if (!EstadoSala.ehProfessor && !EstadoSala.salaAtual) {
        GerenciadorSala.criarSala()
            .then(() => {
                setTimeout(() => {
                    GerenciadorSala.atualizarListaAlunos();
                }, 1000);
            });
    } else if (EstadoSala.ehProfessor) {
        GerenciadorSala.atualizarListaAlunos();
        GerenciadorSala.atualizarUIProfessor();
    }

    if (window.api && api.socket) {
        api.onNovoAluno((data) => {
            if (data.salaId === EstadoSala.salaAtual?.salaId) {
                GerenciadorSala.atualizarListaAlunos();
            }
        });
    }
}

async function gerarNovoCodigoSala() {
    if (confirm('Gerar um novo código irá desconectar todos os alunos. Continuar?')) {
        try {
            mostrarCarregamento();

            // Cria uma nova sala e espera o retorno do novo código
            const novoCodigo = await GerenciadorSala.criarSala();

            // Atualiza o código mostrado na tela
            const elementoCodigo = document.getElementById('qr-room-code');
            if (elementoCodigo) elementoCodigo.textContent = novoCodigo;

            // Limpa o container do QR antigo
            const containerQR = document.getElementById('qr-code-container');
            if (containerQR) containerQR.innerHTML = '';

            // Marca que ainda não tem QR gerado
            EstadoSala.qrCodeGerado = false;

            // Gera automaticamente o novo QR Code
            await window.GerenciadorSala.gerarQRCode();

            esconderCarregamento();
            showToast(`Novo QR Code gerado com sucesso! Código: ${novoCodigo}`, 'success');

        } catch (error) {
            esconderCarregamento();
            showToast('Erro ao gerar novo QR Code: ' + error.message, 'error');
            console.error(error);
        }
    }
}
window.gerarNovoCodigoSala = gerarNovoCodigoSala;





//Sistema de QR Code
function gerarQRCode() {
    if (!EstadoSala.codigoSala) {
        showToast('Nenhuma sala ativa', 'error');
        return;
    }

    fecharTodasSecoes();
    const secao = document.getElementById('qr-code-section');
    if (secao) {
        secao.style.display = 'block';
        secao.scrollIntoView({ behavior: 'smooth' });

        if (!EstadoSala.qrCodeGerado) {
            mostrarCarregamento();

            window.GerenciadorSala.gerarQRCode()
                .then(() => {
                    esconderCarregamento();
                    showToast('QR Code gerado com sucesso!', 'success');
                })
                .catch(error => {
                    esconderCarregamento();
                    showToast(`Erro ao gerar QR Code: ${error}`, 'error');
                });
        }
    }
}

function baixarQRCode() {
    GerenciadorSala.baixarQRCode();
}
window.gerarQRCode = gerarQRCode;
window.baixarQRCode = baixarQRCode;





//Sistema de Atividades
function abrirAtividadesProfessor() {
    fecharTodasSecoes();
    const secao = document.getElementById('teacher-activities-section');
    if (secao) {
        secao.style.display = 'block';
        secao.scrollIntoView({ behavior: 'smooth' });

        window.sistemaAtividades.atualizarUIProfessor();
    }
}

function abrirAtividadesAluno() {
    fecharTodasSecoes();
    const secao = document.getElementById('student-activities-section');
    if (secao) {
        secao.style.display = 'block';
        secao.scrollIntoView({ behavior: 'smooth' });

        if (window.sistemaAtividades) {
            window.sistemaAtividades.atualizarUIAluno();
        }
    }
};
window.abrirAtividadesProfessor = abrirAtividadesProfessor;
window.abrirAtividadesAluno = abrirAtividadesAluno;




//Sair ou fechar Sala
function sairAtividade() {
    const modal = document.getElementById('create-activity-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('active');
        // Focar no título
        setTimeout(() => {
            const inputTitulo = document.getElementById('activity-title');
            if (inputTitulo) inputTitulo.focus();
        }, 100);
    }
}

async function expulsarAluno(alunoId, nomeAluno) {
    if (confirm(`Expulsar ${nomeAluno} da sala? O aluno será desconectado imediatamente.`)) {
        try {

            const idUsuario = localStorage.getItem('idUsuario')
            mostrarCarregamento();

            await GerenciadorSala.expulsarAluno(idUsuario, alunoId);

        } catch (error) {
            console.error('Erro ao expulsar aluno:', error);
        }
    }
}

function encerrarSala() {
    if (confirm('Tem certeza que deseja encerrar a sala? Todos os alunos serão desconectados.')) {
        GerenciadorSala.encerrarSala();
    }
}

function sairSala() {
    if (confirm('Tem certeza que deseja sair da sala?')) {
        GerenciadorSala.sairSala();
    }
}
window.encerrarSala = encerrarSala;
window.sairSala = sairSala;
window.sairAtividade = sairAtividade;
window.expulsarAluno = expulsarAluno;




//Sistema de Mão Levantada
function abrirMaosLevantadas() {
    fecharTodasSecoes();
    const secao = document.getElementById('raised-hands-section');
    if (secao) {
        secao.style.display = 'block';
        secao.scrollIntoView({ behavior: 'smooth' });
    }
    GerenciadorMaoLevantada.carregarMaosLevantadas();
}

function levantarMao() {
    const statusMao = document.querySelector(".feature-item h3");
    const iconeEmoji = document.querySelector(".feature-icon p");
    const divCriacao = document.createElement("div");
    divCriacao.classList.add("status-circle");
    const nomeAluno = GerenciadorAluno.obterNome();

    if (!nomeAluno) {
        showToast('Por favor, digite seu nome primeiro', 'error');
        return;
    }

    const icone = document.querySelector("#iconeMao i");

    if (icone.classList.contains("fa-hand-point-up")) {
        icone.classList.remove("fa-hand-point-up");
        icone.classList.add("fa-hand-fist");

        iconeEmoji.textContent = "✊";

        statusMao.innerHTML = "Mão Abaixada ";
        divCriacao.style.backgroundColor = "red";
        statusMao.appendChild(divCriacao);
    } else {
        icone.classList.remove("fa-hand-fist");
        icone.classList.add("fa-hand-point-up");

        iconeEmoji.textContent = "🙋‍♂️";

        //Texto
        divCriacao.style.backgroundColor = "blue";
        statusMao.innerHTML = "Mão Levantada ";
        statusMao.appendChild(divCriacao);
    }
    GerenciadorMaoLevantada.levantarMao(nomeAluno);
}

function reconhecerMao(alunoId) {
    GerenciadorMaoLevantada.reconhecerMao(alunoId);
}
window.levantarMao = levantarMao;
window.abrirMaosLevantadas = abrirMaosLevantadas;
window.reconhecerMao = reconhecerMao;





window.addEventListener('DOMContentLoaded', () => {
    const hash = window.location.hash;
    if (!hash) return;

    if (hash.startsWith('#join/')) {
        const codigoSala = hash.replace('#join/', '').trim();

        mostrarAcessoAluno();
        mostrarInputCodigo();

        setTimeout(() => {
            const inputCodigo = document.getElementById('code-input');
            if (inputCodigo) {
                inputCodigo.value = codigoSala;

                showToast(`Entrando na sala ${codigoSala}...`, 'info');

                entrarSalaPorCodigo(codigoSala);
            } else {
                console.error("❌ Elemento #room-code-input não encontrado.");
            }
        }, 600);
    }
});

window.addEventListener('popstate', function (e) {
    if (e.state && e.state.pagina) {
        carregarConteudoPagina(e.state.pagina);
    } else {
        navegarPara('home');
    }
});


