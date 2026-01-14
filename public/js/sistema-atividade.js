

class SistemaAtividades {
    constructor() {
        this.atividades = [];
        this.respostas = [];
        this.escutadores = [];
        this.inicializar();
    }

    inicializar() {
        this.vincularEventos();

        if (!EstadoSala.codigoSala) {
            this.esperarEstadoSala();
        }
    }

    esperarEstadoSala = () => {
        const verificarEstadoSala = setInterval(() => {
            if (EstadoSala && EstadoSala.codigoSala) {
                clearInterval(verificarEstadoSala);
            }
        }, 500);
    }

    vincularEventos() {
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="create-activity"]')) {
                this.abrirModalCriarAtividade();
            }
            if (e.target.matches('[data-action="save-activity"]')) {
                this.salvarAtividade();
            }
            if (e.target.matches('[data-action="delete-activity"]')) {
                const activityId = e.target.dataset.activityId;
                this.deletarAtividade(activityId);
            }
            if (e.target.matches('[data-action="close-modal"]')) {
                this.fecharTodosModais();
            }
        });

    }


    abrirModalCriarAtividade() {
        const modal = document.getElementById('create-activity-modal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');

            this.limparFormularioAtividade();

            setTimeout(() => {
                const titleInput = document.getElementById('activity-title');
                if (titleInput) titleInput.focus();
            }, 100);
        }
    }

    async salvarAtividade() {
        const titulo = document.getElementById('activity-title')?.value.trim();
        const decricao = document.getElementById('activity-description')?.value.trim();
        const tipo = document.getElementById('activity-type')?.value;
        const data = document.getElementById('activity-due-date')?.value;

        if (!titulo) {
            showToast('Por favor, digite o título da atividade', 'error');
            return;
        }

        if (!decricao) {
            showToast('Por favor, digite a descrição da atividade', 'error');
            return;
        }

        try {

            const idUsuario = localStorage.getItem('idUsuario');
            const idSala = localStorage.getItem('idSala');

            // Usar API diretamente
            await window.api.criarAtividade(
                idSala,
                idUsuario,
                titulo,
                decricao,
                data || null,
                tipo
            );

            showToast('Atividade criada com sucesso!', 'success');
            this.fecharTodosModais();

            // Recarregar atividades
            await this.carregarAtividades();

        } catch (error) {
            showToast('Erro ao criar atividade: ' + error.message, 'error');
            console.error('Erro ao criar atividade:', error);
        }
    }

    async deletarAtividade(idAtividade) {
        // Encontrar a atividade para mostrar o nome na confirmação
        const atividade = this.atividades.find(a => a.id === idAtividade);
        const nomeAtividade = atividade?.titulo || 'esta atividade';

        const confirmar = await mostrarModalGeral(
            `Tem certeza que deseja excluir a atividade "${nomeAtividade}"? Esta ação não pode ser desfeita.`,
            'desfazer',
            'Excluir Atividade'
        );

        if (!confirmar) {
            return;
        }

        try {
            showToast('Excluindo atividade...', 'info');


            const idSala = localStorage.getItem('idSala');
            const idUsuario = localStorage.getItem('idUsuario');

            // Usar API diretamente
            await window.api.apagarAtividade(
                idSala,
                idUsuario,
                idAtividade
            );

            showToast('Atividade excluída com sucesso!', 'success');


            // Remover a atividade da lista local
            this.atividades = this.atividades.filter(a => a.id !== idAtividade);
            this.atualizarUIProfessor();

            if (this.atividades.length === 0) {
                fecharTodasSecoes();
            }
        } catch (error) {
            console.error('Erro ao excluir atividade:', error);
            showToast('Erro ao excluir atividade: ' + error.message, 'error');
        }
    }

    async carregarAtividades() {
        try {
            const idSala = localStorage.getItem('idSala');
            const idUsuario = localStorage.getItem('idUsuario');

            if (!idSala || !idUsuario) {
                console.error('❌ Sala ou usuário não disponível');
                return;
            }

            const resposta = await window.api.listarAtividades(
                idSala,
                idUsuario
            );

            this.atividades = resposta.todasAtividades || [];

            // Atualizar UI baseado no tipo de usuário
            if (EstadoSala.ehProfessor) {
                this.atualizarUIProfessor();
            } else if (EstadoSala.ehAluno) {
                await this.atualizarUIAluno();
            }

        } catch (error) {
            console.error('Erro ao carregar atividades:', error);
        }
    }

    async atualizarUIAluno() {
        const container = document.getElementById('student-activities-list');

        if (!container) {
            console.error('❌ Container student-activities-list não encontrado');
            return;
        }

        if (this.atividades.length === 0) {
            container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tasks" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                <p>Nenhuma atividade disponível</p>
                <small>Quando o professor criar atividades, elas aparecerão aqui</small>
            </div>
        `;
            return;
        }

        const nomeAluno = GerenciadorAluno.nomeAtual || localStorage.getItem('studentName') || 'Aluno';
        const idUsuario = localStorage.getItem('idUsuario');
        const idSala = localStorage.getItem('idSala');

        // Carregar respostas do aluno para verificar status
        const atividadesComStatus = await Promise.all(
            this.atividades.map(async (atividade) => {
                try {
                    // 🔥 MUDANÇA IMPORTANTE: Usar a função correta da API
                    const respostasData = await window.api.listarRespostas(
                        idUsuario,
                        idSala,
                        atividade.id
                    );

                    // Verificar se o aluno já respondeu
                    const alunoRespondeu = respostasData && respostasData.some(resposta =>
                        resposta.studentId === idUsuario
                    );

                    return {
                        ...atividade,
                        respondeu: alunoRespondeu,
                        respostaId: alunoRespondeu ?
                            respostasData.find(r => r.studentId === idUsuario)?.id : null
                    };
                } catch (error) {
                    console.error(`❌ Erro ao verificar resposta da atividade ${atividade.id}:`, error);
                    return { ...atividade, respondeu: false };
                }
            })
        );


        // Renderizar HTML
        container.innerHTML = atividadesComStatus.map(atividade => {
            // 🔥 CORRIGIR: Usar os atributos corretos da atividade
            const buttonClass = atividade.respondeu ? 'btn btn-danger' : 'btn btn-primary';
            const buttonIcon = atividade.respondeu ? 'fa-times-circle' : 'fa-paper-plane';
            const buttonText = atividade.respondeu ? 'Cancelar Resposta' : 'Responder';

            const buttonAction = atividade.respondeu ?
                `window.cancelarRespostaAluno('${atividade.id}', '${atividade.respostaId}')` :
                `window.responderComoAluno('${atividade.id}')`;

            const statusBadge = atividade.respondeu ?
                '<span class="status-badge responded">✓ Respondido</span>' :
                '<span class="status-badge pending">⏱ Pendente</span>';

            return `
        <div class="activity-item student-activity">
            <div class="activity-header">
                <div class="activity-title-container">
                    <h4>${atividade.titulo}</h4>
                    ${statusBadge}
                </div>
                <span class="activity-type">${atividade.tipo || 'tarefa'}</span>
            </div>
            <div class="activity-body">
                <p>${atividade.descricao}</p>
                ${atividade.prazo ? `
                    <div class="activity-deadline">
                        <i class="fas fa-clock"></i>
                        <small>Prazo: ${new Date(atividade.prazo).toLocaleString('pt-BR')}</small>
                    </div>
                ` : ''}
            </div>
            <div class="activity-actions">
                <button class="${buttonClass}" onclick="${buttonAction}">
                    <i class="fas ${buttonIcon}"></i> ${buttonText}
                </button>
            </div>
        </div>
        `;
        }).join('');

    }

    atualizarUIProfessor() {
        const container = document.getElementById('teacher-activities-list');

        if (!container) {
            return;
        }

        if (this.atividades.length === 0) {
            container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tasks"></i>
                <p>Nenhuma atividade criada ainda</p>
                <button class="btn btn-primary" data-action="create-activity">
                    <i class="fas fa-plus"></i> Criar Primeira Atividade
                </button>
            </div>
        `;
            return;
        }

        container.innerHTML = this.atividades.map(atividade => {
            return `
            <div class="activity-item">
                <div class="activity-header">
                    <h4>${atividade.titulo || 'Sem título'}</h4>
                    <span class="activity-type">${atividade.tipo || 'tarefa'}</span>
                </div>
                <div class="activity-body">
                    <p>${atividade.descricao || 'Sem descrição'}</p>
                    ${atividade.prazo ?
                    `<small>Prazo: ${new Date(atividade.prazo).toLocaleString('pt-BR')}</small>` :
                    '<small>Sem prazo definido</small>'}
                </div>
                <div class="activity-actions">
                    <button class="btn btn-small btn-success" 
                            onclick="window.sistemaAtividades.mostrarListaAlunos('${atividade.id}', '${atividade.titulo}')" 
                            title="Ver alunos e status">
                        <i class="fas fa-list"></i> Listar
                    </button>
                    <button class="btn btn-small btn-danger" 
                            onclick="window.sistemaAtividades.deletarAtividade('${atividade.id}')" 
                            title="Excluir atividade">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            </div>
            <hr>
        `;
        }).join('');
    }

    async atualizarStatusRespostas(idAtividade) {
        try {
            const idUsuario = localStorage.getItem('idUsuario');

            const respostas = await window.api.respostasPorAtividade(
                idUsuario,
                idAtividade
            );

            EstadoSala.respostasAtividade = {};

            respostas.respostas.forEach(resposta => {
                EstadoSala.respostasAtividade[resposta.alunoNome] = {
                    ...resposta,
                    respondidaEm: resposta.respondidaEm || new Date()
                };
            });

            if (EstadoSala.atividadeAtivaId === idAtividade) {
                window.GerenciadorSala.atualizarListaAlunos();
            }

        } catch (error) {
            console.error('Erro ao atualizar status de respostas:', error);
        }
    }

    limparFormularioAtividade() {
        const title = document.getElementById('activity-title');
        const description = document.getElementById('activity-description');
        const type = document.getElementById('activity-type');
        const dueDate = document.getElementById('activity-due-date');

        if (title) title.value = '';
        if (description) description.value = '';
        if (type) type.value = 'tarefa';
        if (dueDate) dueDate.value = '';
    }

    fecharTodosModais() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
            modal.classList.remove('active');
        });
    }



    async mostrarListaAlunos(idAtividade, tituloAtividade) {
        const connectedStudentsSection = document.getElementById('connected-students-section');
        if (connectedStudentsSection) {
            connectedStudentsSection.scrollIntoView({ behavior: 'smooth' });
        }

        EstadoSala.atividadeAtivaId = idAtividade;

        mostrarCarregamento();

        try {
            await this.atualizarStatusRespostas(idAtividade);
        } catch (error) {
            console.error('Erro ao carregar respostas:', error);
        }

        window.GerenciadorSala.atualizarListaAlunos();

        esconderCarregamento();
        showToast(`Visualizando respostas: ${tituloAtividade}`, 'info');
    }

    limpar() {
        this.escutadores = [];
        this.atividades = [];
        this.respostas = [];
    }
}


// Função para aluno cancelar resposta
async function cancelarRespostaAluno(idAtividade, respostaId) {
    try {
        const nomeAluno = GerenciadorAluno.nomeAtual || localStorage.getItem('studentName');
        const idUsuario = EstadoSala.idUsuario || localStorage.getItem('idUsuario');

        if (!idAtividade || !respostaId || !idUsuario || !nomeAluno) {
            showToast('Erro ao cancelar resposta. Verifique seus dados.', 'error');
            return;
        }

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
            'desfazer',
            'Enviar Resposta'
        );

        if (!confirmar) {
            return;
        }
        else {
            await confirmarCancelarResposta(idAtividade, nomeAluno, respostaId)
        }

    } catch (error) {
        console.error('❌ Erro ao processar cancelamento:', error);
        showToast('Erro ao processar cancelamento. Tente novamente.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.sistemaAtividades = new SistemaAtividades();
    }, 500);
});

window.cancelarRespostaAluno = cancelarRespostaAluno;
export default SistemaAtividades;
