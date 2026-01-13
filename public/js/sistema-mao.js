if (!window.EstadoSala) {
    console.warn('EstadoSala não disponível, aguardando...');
    window.EstadoSala = window.EstadoSala || {
        idAluno: null,
        idUsuario: null,
        salaAtual: null,
        ehProfessor: false,
        ehAluno: false,
        codigoSala: null
    };
}

const EstadoMaoLevantada = {
    maosLevantadas: [],
    maoAlunoLevantada: false,
    ultimaHoraLevantada: null,
    escutadores: [],
    somNotificacao: null,
    carregando: false
};

const GerenciadorMaoLevantada = {

    // FUNÇÃO PARA INICIALIZAR O SOM - ADICIONE ISSO
    inicializarSomNotificacao: () => {
        try {
            // Cria o som usando Howler.js
            EstadoMaoLevantada.somNotificacao = new Howl({
                src: ['sons/notificacao.mp3'],
                volume: 1.0,
                preload: true,
                onloaderror: function () {
                    GerenciadorMaoLevantada.criarSomAlternativo();
                }
            });
        } catch (error) {
            console.warn('Erro ao inicializar Howler:', error);
            GerenciadorMaoLevantada.criarSomAlternativo();
        }
    },

    criarSomAlternativo: () => {
        try {
            // Cria um som simples como fallback
            const contextoAudio = new (window.AudioContext || window.webkitAudioContext)();
            const oscilador = contextoAudio.createOscillator();
            const noGanho = contextoAudio.createGain();

            oscilador.connect(noGanho);
            noGanho.connect(contextoAudio.destination);

            oscilador.frequency.setValueAtTime(800, contextoAudio.currentTime);
            oscilador.frequency.setValueAtTime(600, contextoAudio.currentTime + 0.1);
            noGanho.gain.setValueAtTime(0.3, contextoAudio.currentTime);
            noGanho.gain.exponentialRampToValueAtTime(0.01, contextoAudio.currentTime + 0.5);

            oscilador.start(contextoAudio.currentTime);
            oscilador.stop(contextoAudio.currentTime + 0.5);
        } catch (error) {
            console.log('Áudio não suportado');
        }
    },

    // FUNÇÃO PARA TOCAR O SOM
    tocarSomNotificacao: () => {
        if (EstadoMaoLevantada.somNotificacao) {
            try {
                EstadoMaoLevantada.somNotificacao.play();
            } catch (error) {
                console.warn('Erro ao tocar som com Howler:', error);
                GerenciadorMaoLevantada.criarSomAlternativo();
            }
        } else {
            GerenciadorMaoLevantada.criarSomAlternativo();
        }
    },

    levantarMao: async (nomeAluno = null) => {
        const buttonAtivacao = document.querySelector('div[onclick="levantarMao()"]');

        if (!buttonAtivacao) {
            showToast('Elemento não encontrado', 'error');
            return;
        }
        if (EstadoMaoLevantada.carregando) {
            showToast('Aguarde, carregando...', 'info');
            return;
        }

        buttonAtivacao.style.pointerEvents = 'none';
        buttonAtivacao.style.opacity = '0.6';

        EstadoMaoLevantada.carregando = true;

        const alunoId = localStorage.getItem('idUsuario');
        if (!alunoId) {
            showToast('ID do aluno não encontrado', 'error');
            buttonAtivacao.style.pointerEvents = 'all';
            buttonAtivacao.style.opacity = '1';
            EstadoMaoLevantada.carregando = false;
            return false;
        }

        const nome = nomeAluno || GerenciadorAluno.obterNome();
        if (!nome) {
            showToast("Nome do aluno não encontrado", "error");
            buttonAtivacao.style.pointerEvents = 'all';
            buttonAtivacao.style.opacity = '1';
            EstadoMaoLevantada.carregando = false;
            return false;
        }

        try {
            const levantada = !EstadoMaoLevantada.maoAlunoLevantada;

            await window.api.mudarStatusMao(alunoId, alunoId, levantada);

            EstadoMaoLevantada.maoAlunoLevantada = levantada;
            EstadoMaoLevantada.ultimaHoraLevantada = levantada ? new Date() : null;

            const mensagem = levantada ? 'Mão levantada! O professor foi notificado.' : 'Mão abaixada';
            const tipo = levantada ? 'success' : 'info';

            showToast(mensagem, tipo);


            return levantada;
        } catch (error) {
            showToast('Erro ao levantar a mão: ' + error.message, 'error');
            console.error('Erro ao levantar a mão:', error);
            return false;
        } finally {
            EstadoMaoLevantada.carregando = false;
            buttonAtivacao.style.pointerEvents = 'all';
            buttonAtivacao.style.opacity = '1';
        }
    },

    atualizarBotaoMaoAluno: () => {
        const botaoMao = document.querySelector('div[onclick="levantarMao()"]');
        if (!botaoMao) return;

        const texto = botaoMao.querySelector('h3');

        if (EstadoMaoLevantada.maoAlunoLevantada) {
            // Mantém ícones originais
            texto.innerHTML = 'Mão Levantada';
            botaoMao.classList.add('hand-raised');
        } else {
            texto.innerHTML = 'Mão Abaixada';
            botaoMao.classList.remove('hand-raised');
        }
    },

    mostrarNotificacaoProfessor: (contagem) => {
        const notificacaoExistente = document.querySelector('.raised-hand-notification');
        if (notificacaoExistente) {
            notificacaoExistente.remove();
        }

        GerenciadorMaoLevantada.tocarSomNotificacao();

        const notificacao = document.createElement('div');
        notificacao.className = 'raised-hand-notification';
        notificacao.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-hand-paper"></i>
                <span>${contagem} aluno${contagem > 1 ? 's' : ''} com a mão levantada</span>
                <i class="fas fa-volume-up" style="margin-left: auto;"></i>
            </div>
        `;

        document.body.appendChild(notificacao);

        setTimeout(() => {
            if (notificacao.parentNode) {
                notificacao.remove();
            }
        }, 5000);

        notificacao.addEventListener('click', () => {
            abrirMaosLevantadas();
            notificacao.remove();
        });
    },

    atualizarDisplayMaosProfessor: () => {
        const secaoMaos = document.getElementById('raised-hands-section');
        if (!secaoMaos) return;

        const listaMaos = secaoMaos.querySelector('.raised-hands-list');
        if (!listaMaos) return;

        if (EstadoMaoLevantada.maosLevantadas.length === 0) {
            listaMaos.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-hand-paper" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p>Nenhum aluno com a mão levantada</p>
                </div>
            `;
            return;
        }

        listaMaos.innerHTML = EstadoMaoLevantada.maosLevantadas.map(mao => `
            <div class="raised-hand-item">
                <div class="hand-student-info">
                    <i class="fas fa-hand-paper hand-icon"></i>
                    <span class="student-name">${mao.nome}</span>
                </div>
                <div class="hand-actions">
                    <span class="hand-time">${mao.maoLevantadaEm ? new Date(mao.maoLevantadaEm).toLocaleTimeString() : ''}</span>
                    <button class="btn btn-small btn-secondary" onclick="reconhecerMao('${mao.id}')">
                        <i class="fas fa-check"></i> Atender
                    </button>
                </div>
            </div>
        `).join('');
    },

    reconhecerMao: async (idAluno) => {
        try {
            const idUsuario = localStorage.getItem('idUsuario')
            await window.api.mudarStatusMao(idAluno, idUsuario, false);
            showToast('Mão atendida com sucesso!', 'success');
        } catch (error) {
            showToast('Erro ao atender a mão: ' + error.message, 'error');
            console.error('Erro ao atender a mão:', error);
        }
    },

    limparTodasMaos: async () => {
        if (confirm('Tem certeza que deseja limpar todas as mãos levantadas?')) {
            try {
                const idAluno = localStorage.getItem('idUsuario')
                // Usar API para limpar todas as mãos
                await window.api.apagarTodasMaos(idAluno);

                showToast('Todas as mãos foram abaixadas', 'info');
            } catch (error) {
                showToast('Erro ao limpar mãos levantadas: ' + error.message, 'error');
                console.error('Erro ao limpar mãos levantadas:', error);
            }
        }
    },

    carregarMaosLevantadas: async () => {
        try {

            const idUsuario = localStorage.getItem('idUsuario');
            const idSala = localStorage.getItem('idSala');

            if (!idSala || !idUsuario) {
                return;
            }

            // Buscar lista de alunos da sala
            const alunosPegos = await window.api.listarAlunos(
                idUsuario,
                idSala
            );

            // Filtrar apenas alunos com mão levantada
            const maosLevantadas = alunosPegos.todosAlunos.filter(aluno => aluno.maoLevantada === true);

            const contagemAnterior = EstadoMaoLevantada.maosLevantadas.length;
            EstadoMaoLevantada.maosLevantadas = maosLevantadas.sort((a, b) =>
                (a.maoLevantadaEm || 0) - (b.maoLevantadaEm || 0)
            );

            GerenciadorMaoLevantada.atualizarDisplayMaosProfessor();

            if (EstadoSala.ehProfessor && maosLevantadas.length > contagemAnterior) {
                GerenciadorMaoLevantada.mostrarNotificacaoProfessor(maosLevantadas.length);
            }
        } catch (error) {
            console.error('Erro ao carregar mãos levantadas:', error);
        }
    },

    inicializar: async () => {
        // 🔥 INICIALIZA O SOM QUANDO O GERENCIADOR COMEÇA
        GerenciadorMaoLevantada.inicializarSomNotificacao();

        if (EstadoSala.ehAluno && EstadoSala.idAluno) {
            // Buscar status atual do aluno via API
            try {
                const idAluno = localStorage.getItem('idUsuario')
                const alunos = await window.api.listarAlunos(
                    idAluno,
                    EstadoSala.salaAtual.salaId
                );

                const aluno = alunos.find(a => a.id === EstadoSala.idAluno);
                if (aluno) {
                    EstadoMaoLevantada.maoAlunoLevantada = aluno.maoLevantada || false;
                }
            } catch (error) {
                console.error('Erro ao buscar status do aluno:', error);
            }
        }
    },

    limpar: () => {
        EstadoMaoLevantada.escutadores.forEach(escutador => escutador());
        EstadoMaoLevantada.escutadores = [];
        EstadoMaoLevantada.maosLevantadas = [];
        EstadoMaoLevantada.maoAlunoLevantada = false;
        EstadoMaoLevantada.ultimaHoraLevantada = null;

        // Limpa o som do Howler se existir
        if (EstadoMaoLevantada.somNotificacao) {
            EstadoMaoLevantada.somNotificacao.unload();
        }
    },

};

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', async () => {
    // Aguarda o EstadoSala carregar corretamente
    const aguardarEstadoSala = async () => {
        return new Promise(resolve => {
            const verificar = () => {
                if (EstadoSala && EstadoSala.codigoSala) resolve();
                else setTimeout(verificar, 300);
            };
            verificar();
        });
    };

    await aguardarEstadoSala();

    GerenciadorMaoLevantada.inicializar();
});
window.GerenciadorMaoLevantada = GerenciadorMaoLevantada;