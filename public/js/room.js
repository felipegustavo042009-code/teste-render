import { sistemaApi } from './servicos-api.js';

const api = new sistemaApi();

const EstadoSala = {
    salaAtual: null,
    ehProfessor: false,
    ehAluno: false,
    alunosConectados: [],
    codigoSala: null,
    qrCodeGerado: false,
    atividadeAtivaId: null,
    respostasAtividade: {},
    idUsuario: localStorage.getItem('idUsuario'),
};

const GerenciadorSala = {

    criarSala: async () => {
        try {
            // Primeiro cria/obtém usuário
            if (!EstadoSala.idUsuario) {
                const usuario = await api.criarUsuario();
                EstadoSala.idUsuario = usuario.usuarioId;
            }

            await api.atualizarTipo(EstadoSala.idUsuario, 'professor');

            const idUsuario = localStorage.getItem('idUsuario')

            const resultado = await api.criarSala(idUsuario);

            EstadoSala.codigoSala = resultado.codigo;
            EstadoSala.ehProfessor = true;

            api.conectar();

            GerenciadorSala.atualizarUIProfessor();
            GerenciadorSala.escutarAtualizacoesSala();

            return EstadoSala.codigoSala;
        } catch (error) {
            console.error('Erro ao criar sala:', error);
            showToast('Erro ao criar sala', 'erro');
            throw error;
        }
    },

    sairSala: async () => {
        if (EstadoSala.ehProfessor) {
            GerenciadorSala.encerrarSala();
        } else if (EstadoSala.ehAluno) {
            try {
                const idUsuario = localStorage.getItem('idUsuario');
                const idSala = localStorage.getItem('idSala');

                await api.deletarAluno(idUsuario);

            } catch (error) {
                console.error('Erro ao sair da sala:', error);
                showToast('Erro ao sair da sala', 'erro');
            }

            GerenciadorAluno.limpar();

            EstadoSala.ehAluno = false;
            EstadoSala.salaAtual = null;
            EstadoSala.codigoSala = null;
            EstadoSala.idUsuario = null;

            api.desconectar();
            navegarPara('home');
        }
    },

    atualizarUIProfessor: () => {
        const elementoCodigo = document.getElementById('teacher-room-code');
        const elementoAlunos = document.getElementById('connected-students');

        if (elementoCodigo && EstadoSala.codigoSala) {
            elementoCodigo.textContent = EstadoSala.codigoSala;
        }

        if (elementoAlunos) {
            elementoAlunos.textContent = EstadoSala.alunosConectados.length;
        }
    },

    atualizarUIAluno: () => {
        const elementoCodigo = document.getElementById('codigo-sala-atual');

        if (elementoCodigo && EstadoSala.codigoSala) {
            elementoCodigo.textContent = EstadoSala.codigoSala;
        }
    },

    entrarSala: async (codigoSala) => {
        try {
            // Buscar sala
            const sala = await api.procurarSalaPorCodigo(codigoSala);

            if (!sala || !sala.status) {
                throw new Error('Sala não encontrada ou inativa');
            }

            EstadoSala.salaAtual = sala;
            EstadoSala.ehAluno = true;
            EstadoSala.codigoSala = codigoSala;

            // Criar/obter usuário se necessário
            if (!EstadoSala.idUsuario) {
                const usuario = await api.criarUsuario();
                EstadoSala.idUsuario = usuario.usuarioId;
            }

            // Conectar socket
            api.conectar();
            api.inserirDadosUsuario(EstadoSala.idUsuario, 'aluno', sala.salaId);

            // Configurar listeners de eventos
            GerenciadorSala.configurarEscutadoresSocket();


            // Mostrar modal de nome
            setTimeout(() => {
                if (!GerenciadorAluno.nomeAtual) {
                    GerenciadorAluno.mostrarModalNome();
                } else {
                    GerenciadorAluno.atualizarUIAluno();
                }
            }, 500);

            return sala;
        } catch (error) {
            console.error('Erro ao entrar na sala:', error);
            showToast(error.message || 'Erro ao entrar na sala', 'erro');
            throw error;
        }
    },

    //socket aluno
    configurarEscutadoresSocket: () => {

        const idUsuario = localStorage.getItem('idUsuario');
        const idSala = localStorage.getItem('idSala');

        api.onSalaFechada((data) => {
            if (data.salaId === idSala && !data.ativa) {
                showToast('A sala foi encerrada pelo professor', 'info');
                setTimeout(() => {
                    GerenciadorSala.forcarSaidaSala();
                }, 2000);
            }
        });

        api.onAlunoSaiu((data) => {
            if (data.alunoId === idUsuario) {
                showToast('Você foi removido da sala pelo professor', 'aviso');
                GerenciadorSala.forcarSaidaSala();
            }
        });

        api.onDeletAluno((data) => {
            if (data.salaId === idSala) {
                GerenciadorSala.forcarSaidaSala();
            }
        });

        api.onNovaAtividade((data) => {
            if (data.salaId === idSala) {
                window.sistemaAtividades.carregarAtividades();
            }
        });

        api.onMaosApagadas((data) => {
            if (data.salaId === idSala) {
                const icone = document.querySelector("#iconeMao i");
                if (icone.classList.contains('fa-hand-point-up')) {
                    window.levantarMao();
                }
            }
        });

    },

    //socket professor
    escutarAtualizacoesSala: () => {
        const idUsuario = localStorage.getItem('idUsuario');
        const idSala = localStorage.getItem('idSala');

        api.onNovoAluno((data) => {
            if (data.salaId === idSala && EstadoSala.ehProfessor) {
                api.listarAlunos(idUsuario, idSala)
                    .then(alunos => {
                        EstadoSala.alunosConectados = alunos.todosAlunos;
                        GerenciadorSala.atualizarUIProfessor();
                        GerenciadorSala.listarAlunosConectados();
                    });
            }
        });

        api.onNovaAtividade((data) => {
            if (data.salaId === idSala) {
                window.sistemaAtividades.carregarAtividades();
            }
        });

        api.onNovaResposta((data) => {
            if (EstadoSala.ehProfessor) {
                window.sistemaAtividades.atualizarStatusRespostas(data.activiId);
            }
        });

        api.onAlunoSaiu((data) => {
            if (data.salaId === idSala) {
                // Atualizar lista
                EstadoSala.alunosConectados = EstadoSala.alunosConectados
                    .filter(aluno => aluno.id !== data.alunoId);
                GerenciadorSala.atualizarUIProfessor();
                GerenciadorSala.listarAlunosConectados();
            }
        });


        api.onMaoLevantada((data) => {
            if (data.salaId === idSala) {
                GerenciadorMaoLevantada.carregarMaosLevantadas();
            }
        });
    },

    encerrarSala: async () => {
        const idUsuario = localStorage.getItem('idUsuario');
        const idSala = localStorage.getItem('idSala');
        if (idSala) {
            try {
                mostrarCarregamento();

                await api.deletarSala(idUsuario, idSala);

                showToast('Sala encerrada com sucesso!', 'sucesso');

            } catch (error) {
                console.error('Erro ao encerrar sala:', error);
                showToast('Erro ao encerrar sala: ' + error.message, 'erro');
            } finally {
                esconderCarregamento();

                // Limpar estado
                EstadoSala.salaAtual = null;
                EstadoSala.ehProfessor = false;
                EstadoSala.codigoSala = null;
                EstadoSala.qrCodeGerado = false;
                EstadoSala.alunosConectados = [];
                const idSala = localStorage.setItem('idSala', '');

                api.desconectar();

                setTimeout(() => {
                    navegarPara('home');
                }, 1000);
            }
        }
    },

    expulsarAluno: async (alunoId, nomeAluno) => {

        const idUsuario = localStorage.getItem('idUsuario');

        const confirmado = await mostrarModalGeral(
            `Tem certeza que deseja expulsar <strong>${nomeAluno}</strong> da sala? Esta ação não pode ser desfeita.`,
            'desfazer',
            'Expulsar Aluno',
        );
        if (!confirmado) {
            return false;
        }
        try {
            mostrarCarregamento();

            await api.deletarAluno(idUsuario, alunoId);

            esconderCarregamento();
            showToast(`${nomeAluno} foi expulso da sala`, 'sucesso');
            return true;

        } catch (error) {
            esconderCarregamento();
            console.error('Erro ao expulsar aluno:', error);
            showToast(`Erro ao expulsar aluno: ${error.message}`, 'erro');
            throw error;
        }
    },

    listarAlunosConectados: () => {
        const listaAlunos = document.getElementById('connected-students-list');
        if (!listaAlunos) return;

        // Lógica de contagem de respostas
        let contadorFeitas = 0;
        let contadorPendentes = 0;
        const estaListandoRespostas = !!EstadoSala.atividadeAtivaId;



        if (estaListandoRespostas) {

            EstadoSala.alunosConectados.forEach(aluno => {
                const nomeAluno = aluno.nome || 'Aluno';
                const respondeu = EstadoSala.respostasAtividade &&
                    EstadoSala.respostasAtividade[nomeAluno];

                if (respondeu) {
                    contadorFeitas++;
                } else {
                    contadorPendentes++;
                }
            });

            // Atualizar contador visível
            const elementoContador = document.getElementById('response-counter');
            if (elementoContador) {
                elementoContador.innerHTML = `
                    <div class="contador-wrapper">
                        <div class="counter-item counter-pending"
                        style="background: #fef3c7; color: #92400e;">
                            <i class="fas fa-clock"></i>
                            <span>${contadorPendentes} Pendente</span>
                        </div>
                        <div class="counter-item counter-done" style="background: #d1fae5; color: #065f46;">
                            <i class="fas fa-check-circle"></i>
                            <span>${contadorFeitas} Feita</span>
                        </div>
                    </div>
                `;
                elementoContador.style.display = 'flex';
            }
        } else {
            // Limpar contador quando não houver atividade ativa
            const elementoContador = document.getElementById('response-counter');
            if (elementoContador) {
                elementoContador.innerHTML = '';
                elementoContador.style.display = 'none';
            }
        }

        // Atualizar título da seção
        const tituloSecao = document.querySelector('#connected-students-section .section-header h2');
        if (tituloSecao) {
            if (estaListandoRespostas) {
                tituloSecao.innerHTML = `<i class="fas fa-clipboard-list"></i> Respostas Alunos`;
            } else {
                tituloSecao.innerHTML = `<i class="fas fa-users"></i> Alunos Conectados`;
            }
        }

        if (EstadoSala.alunosConectados.length === 0) {
            listaAlunos.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>Nenhum aluno conectado no momento</p>
            </div>
            `;
            return;
        }

        // Ordenar alunos: primeiro os que responderam, depois alfabeticamente
        const alunosOrdenados = [...EstadoSala.alunosConectados].sort((a, b) => {
            const nomeA = a.nome || 'Aluno';
            const nomeB = b.nome || 'Aluno';

            const respostaA = EstadoSala.respostasAtividade[nomeA];
            const respostaB = EstadoSala.respostasAtividade[nomeB];

            // Se ambos responderam, ordenar por horário
            if (respostaA && respostaB) {
                const horaA = new Date(respostaA.respondidaEm || 0);
                const horaB = new Date(respostaB.respondidaEm || 0);
                return horaA - horaB;
            }

            // Se só A respondeu, A vem primeiro
            if (respostaA && !respostaB) return -1;

            // Se só B respondeu, B vem primeiro
            if (!respostaA && respostaB) return 1;

            return nomeA.localeCompare(nomeB);
        });

        listaAlunos.innerHTML = alunosOrdenados.map(aluno => {
            const nomeAluno = aluno.nome || 'Aluno';
            const resposta = EstadoSala.respostasAtividade[nomeAluno];
            const respondeu = !!resposta;

            // HTML do horário da resposta
            let htmlHorarioResposta = '';
            if (respondeu && resposta.respondidaEm) {
                const horaResposta = new Date(resposta.respondidaEm);
                htmlHorarioResposta = `
                    <div class="horario-resposta">
                        <i class="fas fa-clock"></i>
                        ${horaResposta.toLocaleTimeString('pt-BR')}
                    </div>
                `;
            }

            // HTML do status da atividade (só aparece quando há atividade ativa)
            let htmlStatusAtividade = '';
            if (EstadoSala.atividadeAtivaId) {
                const textoStatus = respondeu ? 'Feita' : 'Pendente';
                const classeStatus = respondeu ? 'status-completed' : 'status-pending';
                const iconeStatus = respondeu ? 'fa-check-circle' : 'fa-clock';

                htmlStatusAtividade = `
                    <div class="activity-status-container">
                        <div class="status-badge ${classeStatus}">
                            <i class="fas ${iconeStatus}"></i>
                            ${textoStatus}
                        </div>
                    </div>
                `;
            }

            // Botão de expulsar (só aparece quando NÃO há atividade ativa)
            const htmlBotaoExpulsar = EstadoSala.atividadeAtivaId ? '' : `
                <button class="btn btn-small btn-danger" 
                        onclick="GerenciadorSala.expulsarAluno('${aluno.id}', '${nomeAluno}')" 
                        title="Remover aluno">
                    <i class="fas fa-user-times"></i> Expulsar
                </button>
            `;
            
            return `
                <div class="connected-student-item">
                    <div class="student-info">
                        <div class="student-avatar">
                            ${nomeAluno.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="student-name">${nomeAluno}</div>
                            <div class="student-join-time">
                                Conectado em: ${aluno.criadoEm ?
                    new Date(aluno.criadoEm).toLocaleString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                    }) :
                    'Agora'}
                            </div>
                            ${htmlHorarioResposta}
                        </div>
                    </div>
                    ${htmlStatusAtividade}
                    <div class="acoes-aluno">
                        ${htmlBotaoExpulsar}
                    </div>
                </div>
            `;
        }).join('');
    },

    atualizarListaAlunos: async () => {
        try {
            const idUsuario = localStorage.getItem('idUsuario');
            const idSala = localStorage.getItem('idSala');

            if (!idUsuario || !idSala) {
                return
            }
            const alunos = await api.listarAlunos(
                idUsuario,
                idSala
            );

            EstadoSala.alunosConectados = alunos.todosAlunos || [];

            // Atualizar UI
            GerenciadorSala.listarAlunosConectados();
            GerenciadorSala.atualizarUIProfessor();

        } catch (error) {
            console.error('Erro ao atualizar lista de alunos:', error);
        }
    },

    forcarSaidaSala: async () => {
        GerenciadorAluno.limpar();

        EstadoSala.ehAluno = false;
        EstadoSala.salaAtual = null;
        EstadoSala.codigoSala = null;
        EstadoSala.idUsuario = null;

        api.desconectar();
        navegarPara('home');
    },

    gerarQRCode: () => {
        return new Promise((resolve, reject) => {

            const idSala = localStorage.getItem('idSala')
            if (!idSala) {
                reject('Nenhuma sala ativa');
                return;
            }

            const qrContainer = document.getElementById('qr-code-container');
            if (!qrContainer) {
                reject('Container do QR Code não encontrado');
                return;
            }

            // Limpar container
            qrContainer.innerHTML = '';

            // Criar URL para entrada na sala
            const baseURL = window.location.origin + window.location.pathname;
            const qrData = `${baseURL}#join/${EstadoSala.codigoSala}`;

            if (typeof QRCode !== 'undefined') {
                QRCode.toCanvas(qrData, { width: 256, margin: 2 }, (error, canvas) => {
                    if (error) {
                        console.error('❌ Erro ao gerar QR Code:', error);
                        reject(error);
                        return;
                    }

                    // Adicionar canvas ao container
                    qrContainer.appendChild(canvas);

                    // Adicionar estilos ao canvas
                    canvas.style.border = '10px solid white';
                    canvas.style.borderRadius = '10px';
                    canvas.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';

                    EstadoSala.qrCodeGerado = true;

                    // Atualizar código exibido
                    const qrRoomCodeElement = document.getElementById('qr-room-code');
                    if (qrRoomCodeElement) {
                        qrRoomCodeElement.textContent = EstadoSala.codigoSala;
                    }

                    showToast('QR Code gerado com sucesso!', 'success');
                    resolve(canvas);
                });
            } else {
                console.warn('⚠️ Biblioteca QRCode não carregada, usando fallback');

                // Fallback quando a biblioteca não está carregada
                const placeholder = document.createElement('div');
                placeholder.className = 'qr-placeholder';
                placeholder.style.cssText = `
                width: 256px;
                height: 256px;
                background: #f0f0f0;
                border: 2px solid #0066cc;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-family: monospace;
                margin: 0 auto;
            `;
                placeholder.innerHTML = `
                <i class="fas fa-qrcode" style="font-size: 4rem; color: #0066cc; margin-bottom: 1rem;"></i>
                <div style="font-size: 1.5rem; font-weight: bold; color: #0066cc;">${EstadoSala.codigoSala}</div>
                <div style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">QR Code da Sala</div>
            `;

                qrContainer.appendChild(placeholder);
                EstadoSala.qrCodeGerado = true;

                // Atualizar código exibido
                const qrRoomCodeElement = document.getElementById('qr-room-code');
                if (qrRoomCodeElement) {
                    qrRoomCodeElement.textContent = EstadoSala.codigoSala;
                }

                showToast('Código exibido (QR Code não disponível)', 'info');
                resolve(placeholder);
            }
        });
    },

    baixarQRCode: () => {
        if (!EstadoSala.qrCodeGerado) {
            showToast('Gere o QR Code primeiro', 'error');
            return;
        }

        const canvas = document.querySelector('#qr-code-container canvas');
        if (!canvas) {
            showToast('QR Code não disponível para download', 'error');
            return;
        }

        try {
            const link = document.createElement('a');
            link.download = `sala-${EstadoSala.codigoSala}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            showToast('QR Code baixado com sucesso!', 'success');
        } catch (error) {
            console.error('❌ Erro ao baixar QR Code:', error);
            showToast('Erro ao baixar QR Code', 'error');
        }
    },
};

const GerenciadorAluno = {
    nomeAtual: null,

    mostrarModalNome: () => {
        const modal = document.getElementById('student-name-modal');
        if (modal) {
            modal.style.display = 'flex';

            setTimeout(() => {
                const inputNome = document.getElementById('input-nome-aluno');
                if (inputNome) inputNome.focus();
            }, 100);
        }
    },

    esconderModalNome: () => {
        const modal = document.getElementById('student-name-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    confirmarNome: async (nome) => {
        if (!nome || nome.trim().length < 2) {
            showToast('Por favor, digite um nome válido (mínimo 2 caracteres)', 'erro');
            return false;
        }

        GerenciadorAluno.nomeAtual = nome.trim();

        const idUsuario = localStorage.getItem('idUsuario');
        const idSala = localStorage.getItem('idSala');

        try {
            const resultado = await api.criarAluno(
                idUsuario,
                GerenciadorAluno.nomeAtual,
                idSala
            );

            const data = resultado;

            window.sistemaAtividades.carregarAtividades();

            GerenciadorAluno.esconderModalNome();

            GerenciadorAluno.atualizarUIAluno();

            showToast(`Bem-vindo, ${GerenciadorAluno.nomeAtual}!`, 'sucesso');


            return true;
        } catch (error) {
            console.error('Erro ao registrar aluno:', error);
            showToast('Erro ao registrar na sala', 'erro');
            return false;
        }
    },

    atualizarUIAluno: () => {
        if (!GerenciadorAluno.nomeAtual) return;

        const cabecalhoSala = document.querySelector('.room-header .container');
        if (!cabecalhoSala) return;

        const codigoSala = EstadoSala.codigoSala;
        const idSala = localStorage.getItem('idSala');

        let divInfoAluno = document.querySelector('.student-info-display');
        if (!divInfoAluno) {
            divInfoAluno = document.createElement('div');
            divInfoAluno.className = 'student-info-display';
            cabecalhoSala.appendChild(divInfoAluno);
        }

        divInfoAluno.innerHTML = `
            <div class="student-welcome">
                <div class="student-avatar">
                    ${GerenciadorAluno.nomeAtual.charAt(0).toUpperCase()}
                </div>
                <div class="student-details">
                    <h3>${GerenciadorAluno.nomeAtual}</h3>
                    <p>Participando da sala ${codigoSala}</p>
                </div>
            </div> `;
    },

    obterNome: () => {
        return GerenciadorAluno.nomeAtual;
    },

    limpar: () => {
        GerenciadorAluno.nomeAtual = null;
        EstadoSala.idUsuario = null;
    },
};

export { GerenciadorSala, GerenciadorAluno, EstadoSala };

if (typeof window !== 'undefined') {
    window.GerenciadorSala = GerenciadorSala;
    window.GerenciadorAluno = GerenciadorAluno;
    window.EstadoSala = EstadoSala;
    window.api = api;
}