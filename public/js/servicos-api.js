const API_URL = '';

export class sistemaApi {
    constructor() {
        this.socket = null;
        this.salaId = localStorage.getItem('idSala') || null;
        // Eventos de socket.io
        this.mudanca = {
            onMaoLevantada: null,
            onNovoAluno: null,
            onDeletAluno: null,
            onAlunoSaiu: null,
            onNovaAtividade: null,
            onNovaResposta: null,
            onSalaFechada: null,
            onMaosApagadas:null
        };
    }

    conectar() {
        this.socket = io(`${API_URL}`);

        this.socket.on('connect', () => {
            if (this.salaId) {
                const idUsuairoAtual = localStorage.getItem('idUsuario');

                this.socket.emit('entrar:sala', { salaId: this.salaId, idUsuario: idUsuairoAtual });
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Erro na conexão:', error);
        });

        //Eventos para ouvir
        this.socket.on('maoLevantada:atualizada', (data) => {
            if (this.mudanca.onMaoLevantada) {
                this.mudanca.onMaoLevantada(data);
            }
        });

        this.socket.on('aluno:atualizado', (data) => {
            if (this.mudanca.onNovoAluno) {
                this.mudanca.onNovoAluno(data);
            }
        });

        this.socket.on('aluno:deletado', (data) => {
            if (this.mudanca.onDeletAluno) {
                this.mudanca.onDeletAluno(data);
            }
        })

        this.socket.on('atividade:atualizado', (data) => {
            if (this.mudanca.onNovaAtividade) {
                this.mudanca.onNovaAtividade(data);
            }
        });

        this.socket.on('resposta:atualizada', (data) => {
            if (this.mudanca.onNovaResposta) {
                this.mudanca.onNovaResposta(data);
            }
        });

        this.socket.on('sala:atualizada', (data) => {
            if (this.mudanca.onSalaFechada) {
                this.mudanca.onSalaFechada(data);
            }
        });
        this.socket.on('maoLevantada:deletada', (data) => {
            if (this.mudanca.onMaosApagadas) {
                this.mudanca.onMaosApagadas(data);
            }
        })

        this.socket.onAny((eventName) => {
            console.log(`📡 Evento recebido: ${eventName}`);
        });
    }

    inserirDadosUsuario(usuarioId, tipo, salaId = null) {
        this.salaId = salaId;

        if (this.socket) {
            this.socket.emit('inserirDadosUsuario', { usuarioId, tipo, salaId });

            if (salaId) {
                this.socket.emit('sala:ouvir', { salaId });
            }
        }
    }

    async criarUsuario() {
        const idUsuario = localStorage.getItem('idUsuario');
        try {
            const resposta = await fetch(`${API_URL}/usuario/criar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ idUsuario })
            });

            if (!resposta.existe) {
                return await resposta.json();
            }

            localStorage.setItem('idUsuario', resposta.usuarioId);

            return await resposta.json();
        } catch (error) {
            showToast('Erro ao criar usuario', 'error')
            console.log(`Erro ao se conectar ao servidor em usuario, error: ${error}`)
        }
    }

    async atualizarTipo(idUsuario, novoTipo, Salaid = null) {
        try {
            const resposta = await fetch(`${API_URL}/usuario/atualizarTipo?idUsuario=${idUsuario}&novoTipo=${novoTipo}&Salaid=${Salaid || ''}`, {
                method: 'PATCH'
            });
            const data = await resposta.json();

            localStorage.setItem('tipoUsuario', resposta.usuarioId);

            // Configurar socket após atualizar tipo
            if (data.salaAtual) {
                this.inserirDadosUsuario(idUsuario, novoTipo, data.salaAtual);
            }

            return data;
        }
        catch (error) {
            showToast('Erro ao atualizar usuario', 'error')
            console.log(`Erro ao se conectar ao servidor em usuario, error: ${error}`)
        }
    }

    async criarAluno(idUsuario, nomeAluno, salaId) {
        try {
            const resposta = await fetch(`${API_URL}/alunos/criar?idUsuario=${idUsuario}&nomeAluno=${nomeAluno}&salaId=${salaId}`, {
                method: 'POST'
            });
            const data = await resposta.json();

            if (data.salaId) {
                this.inserirDadosUsuario(idUsuario, 'aluno', data.salaId);
            }
            return data;
        } catch (error) {
            showToast('Erro ao criar Aluno', 'error')
            console.log(`Erro ao se conectar ao servidor em aluno, error: ${error}`)
        }
    }

    async deletarAluno(idUsuario, idAluno=null) {
        try {
            const url = `${API_URL}/alunos/deletar?idUsuario=${idUsuario}${idAluno ? `&idAluno=${idAluno}` : ''}`;
            const resposta = await fetch(url, {
                method: 'DELETE'
            });
            return await resposta.json();
        } catch (error) {
            showToast('Erro ao deletar Aluno', 'error')
            console.log(`Erro ao se conectar ao servidor em aluno, error: ${error}`)
        }
    }

    async listarAlunos(idUsuario, idSala) {
        try {
            const resposta = await fetch(`${API_URL}/alunos/listar?idUsuario=${idUsuario}&idSala=${idSala}`);
            return await resposta.json();
        } catch (error) {
            showToast('Erro ao lsitar Alunos', 'error')
            console.log(`Erro ao se conectar ao servidor em aluno, error: ${error}`)
        }
    }

    async mudarStatusMao(idAluno, idUsuario, novoStatus) {
        try {
            const resposta = await fetch(`${API_URL}/alunos/statusMaoLevantada/mudasStatus?idUsuario=${idUsuario}&novoStatus=${novoStatus}&idAluno=${idAluno}`, {
                method: 'PATCH'
            });
            return await resposta.json();
        } catch (error) {
            showToast('Erro ao mudar Mão Levantada', 'error')
            console.log(`Erro ao se conectar ao servidor em aluno, error: ${error}`)
        }
    }

    async apagarTodasMaos(idUsuario) {
        try {
            const resposta = await fetch(`${API_URL}/alunos/statusMaoLevantada/apagarTodas?idUsuario=${idUsuario}`, {
                method: 'PATCH'
            });
            return await resposta.json();
        } catch (error) {
            showToast('Erro ao mudar Mão Levantada', 'error')
            console.log(`Erro ao se conectar ao servidor em aluno, error: ${error}`)
        }
    }

    async criarSala(idUsuario) {
        try {
            const resposta = await fetch(`${API_URL}/salas/criar?idUsuario=${idUsuario}`, {
                method: 'POST'
            });
            const data = await resposta.json();

            if (data.salaId) {
                this.inserirDadosUsuario(idUsuario, 'professor', data.salaId);
            }

            localStorage.setItem('idSala', data.salaId)
            localStorage.setItem('tipoUsuario', 'professor')

            return data;
        } catch (error) {
            showToast('Erro ao criar sala', 'error')
            console.log(`Erro ao se conectar ao servidor em sala, error: ${error}`)
        }
    }

    async deletarSala(idUsuario, salaId) {
        try {
            const resposta = await fetch(`${API_URL}/salas/detetarSala?idUsuario=${idUsuario}&salaId=${salaId}`, {
                method: 'DELETE'
            });

            localStorage.setItem('idSala', '')
            localStorage.setItem('tipoUsuario', 'indefinido')
            return await resposta.json();
        } catch (error) {
            showToast('Erro ao deletar sala', 'error')
            console.log(`Erro ao se conectar ao servidor em sala, error: ${error}`)
        }
    }

    async procurarSalaPorCodigo(codigo) {
        try {
            const resposta = await fetch(`${API_URL}/salas/procuraPorCodigo?codigo=${codigo}`);

            const data = await resposta.json();

            localStorage.setItem('idSala', data.salaId);
            return data;
        } catch (error) {
            showToast('Erro ao procurar sala', 'error')
            console.log(`Erro ao se conectar ao servidor em sala, error: ${error}`)
        }
    }

    async criarAtividade(salaId, idUsuario, tituloAtual, descricaoAtual, prazoAtual = null, tipoAtual) {
        try {
            const url = `${API_URL}/atividade/criar?salaId=${salaId}&idUsuario=${idUsuario}&tipoAtual=${tipoAtual}&tituloAtual=${tituloAtual}&descricaoAtual=${descricaoAtual}${prazoAtual ? `&prazoAtual=${prazoAtual}` : ''}`;
            const resposta = await fetch(url, {
                method: 'POST'
            });
            return await resposta.json();
        } catch (error) {
            showToast('Erro ao cria ativiade', 'error')
            console.log(`Erro ao se conectar ao servidor em atividade, error: ${error}`)
        }
    }

    async listarAtividades(salaId, idUsuario) {
        try {
            const resposta = await fetch(`${API_URL}/atividade/listar?salaId=${salaId}&idUsuario=${idUsuario}`, {

            });
            return await resposta.json();
        } catch (error) {
            showToast('Erro ao lsitar ativiade', 'error')
            console.log(`Erro ao se conectar ao servidor em atividade, error: ${error}`)
        }
    }

    async apagarAtividade(salaId, idUsuario, idAtividade) {
        try {
            const resposta = await fetch(`${API_URL}/atividade/apagar?salaId=${salaId}&idUsuario=${idUsuario}&idAtividade=${idAtividade}`, {
                method: 'DELETE'
            });
            return await resposta.json();
        } catch (error) {
            showToast('Erro ao apagar ativiade', 'error')
            console.log(`Erro ao se conectar ao servidor em atividade, error: ${error}`)
        }
    }

    async criarResposta(idUsuario, idSala, activiId) {
        try {
            const resposta = await fetch(`${API_URL}/respostas/criar?idUsuario=${idUsuario}&idSala=${idSala}&activiId=${activiId}`, {
                method: 'POST'
            });
            return await resposta.json();
        } catch (error) {
            showToast('Erro ao cria respostas', 'error')
            console.log(`Erro ao se conectar ao servidor em respostas, error: ${error}`)
        }
    }

    async listarRespostas(idUsuario, idSala, activiId = null) {
        try {
            const url = `${API_URL}/respostas/listar?idUsuario=${idUsuario}&idSala=${idSala}${activiId ? `&activiId=${activiId}` : ''}`;
            const resposta = await fetch(url);
            const dado = await resposta.json();

            return dado.respostas;
        } catch (error) {
            showToast('Erro ao lsitar respostas', 'error')
            console.log(`Erro ao se conectar ao servidor em respostas, error: ${error}`)
        }
    }

    async apagarResposta(idUsuario, respostaId) {
        try {
            const resposta = await fetch(`${API_URL}/respostas/apagar?idUsuario=${idUsuario}&respostaId=${respostaId}`, {
                method: 'DELETE'
            });
            return await resposta.json();
        } catch (error) {
            showToast('Erro ao apagar respostas', 'error')
            console.log(`Erro ao se conectar ao servidor em respostas, error: ${error}`)
        }
    }

    async respostasPorAtividade(idUsuario, activiId) {
        try {
            const resposta = await fetch(`${API_URL}/respostas/porAtividade?idUsuario=${idUsuario}&activiId=${activiId}`);
            return await resposta.json();
        } catch (error) {
            showToast('Erro ao ver respostas', 'error')
            console.log(`Erro ao se conectar ao servidor em respostas, error: ${error}`)
        }
    }

    async respostasAlunos(idUsuario, activiId) {
        try {
            const resposta = await fetch(`${API_URL}/respostas/porAtividade?idUsuario=${idUsuario}&activiId=${activiId}`);
            return await resposta.json();
        } catch (error) {
            showToast('Erro ao ver respostas', 'error')
            console.log(`Erro ao se conectar ao servidor em respostas, error: ${error}`)
        }
    }

    onMaoLevantada(funcao) {
        this.mudanca.onMaoLevantada = funcao;
    }

    onNovoAluno(funcao) {
        this.mudanca.onNovoAluno = funcao;
    }

    onAlunoSaiu(funcao) {
        this.mudanca.onAlunoSaiu = funcao;
    }

    onDeletAluno(funcao) {
        this.mudanca.onDeletAluno = funcao;
    }

    onNovaAtividade(funcao) {
        this.mudanca.onNovaAtividade = funcao;
    }

    onNovaResposta(funcao) {
        this.mudanca.onNovaResposta = funcao;
    }

    onSalaFechada(funcao) {
        this.mudanca.onSalaFechada = funcao;
    }
    onMaosApagadas(funcao) {
        this.mudanca.onMaosApagadas = funcao;
    }

    desconectar() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

// Instância global
export const api = new sistemaApi();

// Para usar no navegador
window.sistemaApi = sistemaApi;

window.api = api;
