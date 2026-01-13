
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const adm = require('firebase-admin');
const open = require('open').default;
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

adm.initializeApp({
    credential: adm.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
});

const db = adm.firestore();

io.on('connection', (socket) => {

    socket.on('entrar:sala', (data) => {
        if (data.salaId) {
            socket.join(`sala:${data.salaId}`);
        }
        if (data.idUsuario) {
            socket.join(`usuario:${data.idUsuario}`);
        }
    });

    socket.on('disconnect', () => {
    });
});

//Usuarios
app.post('/usuario/criar', async (req, res) => {
    let { usuarioId } = req.body;

    try {
        if (usuarioId) {
            const dados = await db.collection('usuarios').doc(usuarioId).get();

            if (dados.exists) {
                return res.status(200).json({
                    mensagem: 'Usuario ja existe',
                    usuarioId: usuarioId,
                    existe: false
                });
            }
        }

        const novoUsuario = await db.collection('usuarios').add({
            Tipo: 'nada',
            SalaId: null,
            CriadoEm: new Date()
        });

        res.status(200).json({
            mensagem: 'Usuario criado com sucesso',
            usuarioId: novoUsuario.id,
            existe: true
        });
    } catch (error) {
        res.status(500).json({
            mensagem: `Erro ao criar usuario: ${error.message}`

        });
    }
});

app.patch('/usuario/atualizarTipo', async (req, res) => {
    const { idUsuario, novoTipo, Salaid } = req.query;

    if (!idUsuario || !novoTipo) {
        return res.status(400).json({ mensagem: 'Dados de id ou tipo indisponível' })
    }
    try {
        const verificarUsuario = await db.collection('usuarios').doc(idUsuario).get()
        if (!verificarUsuario.exists) {
            return res.status(400).json({
                mensagem: 'Usuário não encontrado'
            })
        }

        const atualizarDados = {
            Tipo: novoTipo
        };

        if (Salaid) {
            atualizarDados.SalaId = Salaid;

            io.to(`sala:${Salaid}`).emit('usuario:atualizado', {
                salaId: Salaid
            });
        }

        await db.collection('usuarios').doc(idUsuario).update(atualizarDados)

        res.status(200).json({
            mensagem: 'Dados Atualizados com sucesso',
            salaAtual: Salaid || verificarUsuario.data().SalaId,
            tipoAtual: novoTipo,
        })

    } catch (error) {
        res.status(500).json({
            mensagem: `Erro ao atualizar usuario: ${error.message}`
        })
    }
})

app.get('/usuario/verificarTipo', async (req, res) => {
    const { idUsuario, idSala } = req.query;

    if (!idUsuario) {
        return res.status(400).json({ mensagem: 'Dados de id indisponivel' })
    }
    try {
        const verificarUsuario = await db.collection('usuarios')
            .where('id', '==', idUsuario)
            .where('SalaId', '==', idSala)
            .get()

        if (!verificarUsuario.empty) {
            return res.status(400).json({
                mensagem: 'Usuário não encontrado'
            })
        }

        if (verificarUsuario.data().Tipo == 'professor') {
            return res.status(200).json({
                mensagem: 'Tipo achado',
                enumStado: 'professor'
            })
        }

        res.status(200).json({
            mensagem: 'Tipo Achado',
            enumStado: 'aluno'
        })

    } catch (error) {
        res.status(500).json({
            mensagem: `Erro ao atualizar usuario: ${error.message}`,
        })
    }
})


//ALunos
app.post('/alunos/criar', async (req, res) => {
    const { idUsuario, nomeAluno, salaId } = req.query;

    if (!idUsuario || !salaId || !nomeAluno) {
        return res.status(400).json({
            mensagem: 'Somente pode criar aluno se tiver nome, salaCorreta e nomeAluno'
        })
    }
    try {
        const testandoUsuario = await db.collection('usuarios').doc(idUsuario).get();
        if (!testandoUsuario.exists) {
            return res.status(400).json({
                mensagem: 'Não pode criar alunos sem id do usuario'
            })
        }

        const testarAluno = await db.collection('alunos').doc(idUsuario).get();
        if (testarAluno.exists) {
            return res.status(200).json({
                mensagem: 'Usuario ja exite pegando informaões',
                salaId: testarAluno.data().SalaId,
                nomeCriado: testarAluno.data().Nome,
                statusMao: testarAluno.data().MaoLevantada
            })
        }

        const salaAchada = await db.collection('salas').doc(salaId).get();
        if (!salaAchada.exists) {
            return res.status(400).json({
                mensagem: 'Sala não existe para poder entrar'
            })
        }

        await db.collection('alunos').doc(idUsuario).set({
            Nome: nomeAluno,
            MaoLevantada: false,
            SalaId: salaId,
            CriadoEm: new Date() 
        })

        await db.collection('usuarios').doc(idUsuario).update({
            Tipo: 'aluno',
            SalaId: salaId
        })

        io.to(`usuario:${salaAchada.data().ProfessorId}`).emit('aluno:atualizado', {
            salaId: salaId
        });

        res.status(200).json({
            mensagem: 'Aluno criado com sucesso',
            salaId: salaId,
            nomeCriado: nomeAluno,
            statusMao: false
        })

    } catch (error) {
        res.status(500).json({
            mensagem: `Erro ao criar aluno: ${error.message}`
        })
    }
})

app.delete('/alunos/deletar', async (req, res) => {
    const { idUsuario, idAluno } = req.query;

    try {
        const verificarUsuario = await db.collection('usuarios').doc(idUsuario).get();
        if (!verificarUsuario.exists) {
            return res.status(400).json({
                mensagem: 'Usuário não encontrado'
            });
        }

        const alunoIdParaDeletar = idAluno || idUsuario;

        const verificarAluno = await db.collection('alunos').doc(alunoIdParaDeletar).get();
        if (!verificarAluno.exists) {
            return res.status(400).json({
                mensagem: 'Aluno não encontrado'
            });
        }

        const verificarSala = await db.collection('salas').doc(verificarAluno.data().SalaId).get();
        if(!verificarSala.exists){
            return res.status(400).json({
                mensagem: 'Sala não encontrado'
            });
        }

        const alunoData = verificarAluno.data();
        const salaId = alunoData.SalaId;

        if (verificarUsuario.data().Tipo === 'professor' && alunoIdParaDeletar !== idUsuario) {
            if (alunoData.SalaId !== verificarUsuario.data().SalaId) {
                return res.status(400).json({
                    mensagem: 'Você não pode apagar alunos de outra sala'
                });
            }
        }

        await db.collection('alunos').doc(alunoIdParaDeletar).delete();

        await db.collection('usuarios').doc(alunoIdParaDeletar).update({
            Tipo: 'nada',
            SalaId: null
        });

        io.to(`usuario:${alunoIdParaDeletar}`).emit('aluno:deletado', {
            salaId: salaId
        });

        io.to(`usuario:${verificarSala.data().ProfessorId}`).emit('aluno:atualizado', {
            salaId: salaId
        });

        return res.status(200).json({
            mensagem: 'Aluno removido com sucesso'
        });

    } catch (error) {
        res.status(500).json({
            mensagem: `Erro ao deletar aluno: ${error.message}`
        });
    }
});

app.get('/alunos/listar', async (req, res) => {
    const { idUsuario, idSala } = req.query;

    try {
        const verificarUsuario = await db.collection('usuarios').doc(idUsuario).get();
        if (!verificarUsuario.exists) {
            return res.status(400).json({
                mensagem: 'Erro, você não tem status para listar dados'
            })
        }
        const verificarSala = await db.collection('salas').doc(idSala).get();
        if (!verificarSala.exists) {
            return res.status(400).json({
                mensagem: 'Sala não existe'
            })
        }

        if (verificarUsuario.data().Tipo !== 'professor' || verificarSala.data().ProfessorId !== idUsuario) {
            return res.status(400).json({
                mensagem: 'Você não tem status para listar',
            })
        }

        const resposta = await db.collection('alunos').where('SalaId', '==', idSala).get();

        const listaALunos = [];
        resposta.forEach(doc => {
            const element = doc.data();
            listaALunos.push({
                id: doc.id,
                nome: element.Nome,
                maoLevantada: element.MaoLevantada,
                criadoEm: element.CriadoEm.toDate()
            })
        });

        return res.status(200).json({
            mensagem: 'Alunos listados com sucesso',
            todosAlunos: listaALunos
        })
    } catch (error) {
        res.status(500).json({
            mensagem: `Erro ao listar aluno: ${error.message}`
        })
    }
})

//Mão levantada
app.patch('/alunos/statusMaoLevantada/mudasStatus', async (req, res) => {
    const { idUsuario, novoStatus, idAluno } = req.query;

    if (!idUsuario || novoStatus === undefined) {
        return res.status(400).json({
            mensagem: 'Somente pode mudar status se tiver idUsuario e o novo status'
        })
    }

    try {

        const verificarUsuario = await db.collection('usuarios').doc(idUsuario).get();
        if (!verificarUsuario.exists) {
            return res.status(400).json({
                mensagem: 'Erro, usuario não encontrado'
            })
        }

        const verificarAluno = await db.collection('alunos').doc(idAluno).get();
        if (!verificarAluno.exists) {
            return res.status(400).json({
                mensagem: 'Erro, aluno não encontrado'
            })
        }

        const verificarSala = await db.collection('salas').doc(verificarAluno.data().SalaId).get();
        if (!verificarSala.exists) {
            return res.status(400).json({
                mensagem: 'Erro, sala não encontrado'
            })
        }

        const alunoData = verificarAluno.data();
        const statusBoolean = novoStatus === 'true' || novoStatus === true;

        await db.collection('alunos').doc(idAluno).update({
            MaoLevantada: statusBoolean,
            MaoAtualizadaEm: new Date()
        })

        if (verificarUsuario.data().Tipo === 'professor') {
            io.to(`usuario:${verificarAluno.id}`).emit('maoLevantada:deletada', {
                salaId: alunoData.SalaId
            })
        }

        io.to(`usuario:${verificarSala.data().ProfessorId}`).emit('maoLevantada:atualizada', {
            salaId: alunoData.SalaId
        });


        return res.status(200).json({
            mensagem: 'Status de mão atualizado com sucesso',
            salaId: alunoData.SalaId
        })
    } catch (error) {
        res.status(500).json({
            mensagem: `Erro ao atualizar mao levantada aluno: ${error.message}`
        })
    }
})

app.patch('/alunos/statusMaoLevantada/apagarTodas', async (req, res) => {
    const { idUsuario } = req.query;

    if (!idUsuario) {
        return res.status(400).json({
            mensagem: 'Somente pode apagar status se tiver idUsuario'
        })
    }

    try {
        const verificarUsuario = await db.collection('usuarios').doc(idUsuario).get();
        if (!verificarUsuario.exists) {
            return res.status(400).json({
                mensagem: 'Erro, você não tem status para apagar dados do usuario'
            })
        }

        if (!verificarUsuario.data().SalaId || verificarUsuario.data().Tipo !== 'professor') {
            return res.status(400).json({
                mensagem: 'So pode apagar todos os dados o professor de sua respectiva sala'
            })
        }

        const salaId = verificarUsuario.data().SalaId;
        const alunosAchados = await db.collection('alunos').where('SalaId', '==', salaId).get();

        const batch = db.batch();
        alunosAchados.forEach(doc => {
            batch.update(doc.ref, { MaoLevantada: false });
        });
        await batch.commit();

        io.to(`sala:${salaId}`).emit('maoLevantada:deletada', {
            salaId: salaId
        });

        return res.status(200).json({
            mensagem: 'Status de mão atualizado com sucesso',
            salaId: salaId
        })
    } catch (error) {
        res.status(500).json({
            mensagem: `Erro ao atualizar mao levantada aluno: ${error.message}`
        })
    }
})

//Salas
function gerarCodigoAleatorio() {
    const valores = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
    let codigoSala = ''

    for (let i = 0; i < 6; i++) {
        const indice = Math.floor(Math.random() * valores.length)
        codigoSala += valores[indice]
    }
    return codigoSala;
}

app.post('/salas/criar', async (req, res) => {
    const { idUsuario } = req.query;

    if (!idUsuario) {
        return res.status(400).json({
            mensagem: 'Somente pode criar sala se estiver um id'
        })
    }

    try {
        let codigoValido = false;
        let codigoAtual = '';

        while (!codigoValido) {
            codigoAtual = gerarCodigoAleatorio();
            const validarCodigo = await db.collection('salas').where('Codigo', '==', codigoAtual).get();
            if (validarCodigo.empty) {
                codigoValido = true;
            }
        }

        const criandoSala = await db.collection('salas').add({
            Codigo: codigoAtual,
            ProfessorId: idUsuario,
            CriadaEm: new Date()
        })

        await db.collection('usuarios').doc(idUsuario).update({
            Tipo: 'professor',
            SalaId: criandoSala.id,
        })

        io.to(`usuario:${idUsuario}`).emit('sala:criada', {});

        return res.status(200).json({
            mensagem: 'Sala criada com sucesso',
            salaId: criandoSala.id,
            codigo: codigoAtual
        })
    } catch (error) {
        res.status(500).json({
            mensagem: `Erro ao criar sala: ${error.message}`
        })
    }
})

app.delete('/salas/detetarSala', async (req, res) => {
    const { idUsuario, salaId } = req.query;

    if (!idUsuario || !salaId) {
        return res.status(400).json({
            mensagem: 'Somente pode deletar sala se estiver um id'
        })
    }

    try {
        const verificarUsuario = await db.collection('usuarios').doc(idUsuario).get();
        if (!verificarUsuario.exists) {
            return res.status(400).json({
                mensagem: 'Erro, você não tem status para deletar uma sala'
            })
        }

        if (verificarUsuario.data().Tipo !== 'professor' || verificarUsuario.data().SalaId !== salaId) {
            return res.status(400).json({
                mensagem: 'Você não tem permissão para apagar essa sala'
            })
        }

        await db.collection('salas').doc(salaId).delete();

        const alunosAchados = await db.collection('alunos').where('SalaId', '==', salaId).get();
        const usuarioAchado = await db.collection('usuarios').where('SalaId', '==', salaId).get();

        const batch = db.batch();

        alunosAchados.forEach(doc => {
            batch.delete(doc.ref);
        });

        usuarioAchado.forEach(doc => {
            batch.update(doc.ref, {
                Tipo: 'nada',
                SalaId: null
            });
        });

        await batch.commit();

        io.to(`sala:${salaId}`).emit('sala:atualizada', {
            salaId: salaId
        });

        return res.status(200).json({
            mensagem: 'Sala apagada com sucesso'
        })
    } catch (error) {
        res.status(500).json({
            mensagem: `Erro ao deletar sala: ${error.message}`
        })
    }
})

app.get('/salas/procura', async (req, res) => {
    const { codigo } = req.query;

    if (!codigo) {
        return res.status(400).json({
            mensagem: 'Somente pode procurar sala se estiver um codigo'
        })
    }
    try {

        const verificarSala = await db.collection('salas').doc(codigo).get();
        if (!verificarSala.exists) {
            return res.status(200).json({
                mensagem: 'Sala não existe',
                status: false
            })
        }

        return res.status(200).json({
            mensagem: 'Sala achada com sucesso',
            status: true,
            codigo: codigo,
            salaId: verificarSala.id
        })
    } catch (error) {
        res.status(500).json({
            mensagem: `Erro ao procurar salas: ${error.message}`
        })
    }
})

app.get('/salas/procuraPorCodigo', async (req, res) => {
    const { codigo } = req.query;

    if (!codigo) {
        return res.status(400).json({ mensagem: 'Código da sala é obrigatório' });
    }

    try {
        const salaAchada = await db.collection('salas')
            .where('Codigo', '==', codigo)
            .limit(1)
            .get();

        if (salaAchada.empty) {
            return res.json({
                status: false,
                mensagem: 'Sala não encontrada'
            });
        }

        const salaDoc = salaAchada.docs[0];
        const salaData = salaDoc.data();
        const ativa = salaData.ativa !== false;

        return res.json({
            status: true,
            salaId: salaDoc.id,
            codigo: salaData.Codigo,
        });

    } catch (error) {
        res.status(500).json({
            mensagem: `Erro ao buscar sala: ${error.message}`
        });
    }
});

//Atividade
app.post('/atividade/criar', async (req, res) => {
    const { salaId, idUsuario, tituloAtual, prazoAtual, descricaoAtual, tipoAtual } = req.query;

    if (!salaId || !idUsuario || !tituloAtual || !descricaoAtual || !tipoAtual) {
        return res.status(400).json({
            mensagem: 'Dados insuficientes para criar atividades'
        })
    }
    try {

        const verificarSala = await db.collection('salas').doc(salaId).get();
        if (!verificarSala.exists) {
            return res.status(400).json({
                mensagem: 'Sala não existe',
            })
        }
        const verificarUsuario = await db.collection('usuarios').doc(idUsuario).get();
        if (!verificarUsuario.exists) {
            return res.status(400).json({
                mensagem: 'Usuário não existe',
            })
        }
        if (verificarUsuario.data().Tipo !== 'professor' || verificarSala.data().ProfessorId !== idUsuario) {
            return res.status(400).json({
                mensagem: 'Você não tem permissão para criar atividades na sala',
            })
        }

        const novaAtividade = await db.collection('atividades').add({
            Titulo: tituloAtual,
            SalaId: salaId,
            Descricao: descricaoAtual,
            Prazo: prazoAtual || null,
            tipoAtual: tipoAtual,
            CriadoEm: new Date()
        })

        io.to(`sala:${salaId}`).emit('atividade:atualizado', {
            salaId: salaId,
            activiId: novaAtividade.id
        });

        return res.status(200).json({
            mensagem: 'Atividade criada com sucesso',
            atividadeId: novaAtividade.id
        })
    } catch (error) {
        res.status(500).json({
            mensagem: `Erro ao criar atividade: ${error.message}`
        })
    }
})

app.get('/atividade/listar', async (req, res) => {
    const { salaId, idUsuario } = req.query;

    if (!salaId || !idUsuario) {
        return res.status(400).json({
            mensagem: 'Dados insuficientes para ver atividades'
        })
    }
    try {
        const verificarSala = await db.collection('salas').doc(salaId).get();
        if (!verificarSala.exists) {
            return res.status(400).json({
                mensagem: 'Sala não existe',
            })
        }
        const verificarUsuario = await db.collection('usuarios').doc(idUsuario).get();
        if (!verificarUsuario.exists) {
            return res.status(400).json({
                mensagem: 'Usuário não existe',
            })
        }
        if (verificarSala.id !== verificarUsuario.data().SalaId) {
            return res.status(400).json({
                mensagem: `Você não tem permissão para ver atividades da sala${verificarSala.id} , ${verificarUsuario.data().SalaId}`,
            })
        }

        const respostasAtividades = await db.collection('atividades').where('SalaId', '==', salaId).get();

        const atividades = [];


        respostasAtividades.forEach(doc => {
            const e = doc.data();
            atividades.push({
                id: doc.id,
                titulo: e.Titulo,
                descricao: e.Descricao,
                criacao: e.CriadoEm,
                tipo: e.tipoAtual,
                prazo: e.Prazo || null
            })
        })

        return res.status(200).json({
            mensagem: 'Atividades listadas com sucesso',
            todasAtividades: atividades
        })
    } catch (error) {
        res.status(500).json({
            mensagem: `Erro ao listar atividade: ${error.message}`
        })
    }
})

app.delete('/atividade/apagar', async (req, res) => {
    const { salaId, idUsuario, idAtividade } = req.query;

    if (!salaId || !idUsuario || !idAtividade) {
        return res.status(400).json({
            mensagem: 'Dados insuficientes para apagar atividades'
        })
    }
    try {

        const verificarSala = await db.collection('salas').doc(salaId).get();
        if (!verificarSala.exists) {
            return res.status(400).json({
                mensagem: 'Sala não existe',
            })
        }
        const verificarUsuario = await db.collection('usuarios').doc(idUsuario).get();
        if (!verificarUsuario.exists) {
            return res.status(400).json({
                mensagem: 'Usuário não existe',
            })
        }
        if (verificarUsuario.data().Tipo !== 'professor' || verificarSala.data().ProfessorId !== idUsuario) {
            return res.status(400).json({
                mensagem: 'Você não tem permissão para mecher na sala',
            })
        }

        const verificarAtividade = await db.collection('atividades').doc(idAtividade).get();
        if (!verificarAtividade.exists || verificarAtividade.data().SalaId !== salaId) {
            return res.status(400).json({
                mensagem: 'Você não tem permissão mecher em atividaes de outra sala'
            })
        }

        await db.collection('atividades').doc(idAtividade).delete();

        io.to(`sala:${salaId}`).emit('atividade:atualizado', {
            salaId: salaId,
            activiId: verificarAtividade.id
        })

        return res.status(200).json({
            mensagem: 'Atividade apagada com sucesso',
        })
    } catch (error) {
        res.status(500).json({
            mensagem: `Erro ao apagar atividade: ${error.message}`
        })
    }
})

//Respostas
app.post('/respostas/criar', async (req, res) => {
    const { idUsuario, idSala, activiId } = req.query;

    if (!idUsuario || !idSala || !activiId) {
        return res.status(400).json({
            mensagem: 'Dados faltando para criar resposta'
        })
    }

    try {
        const verificarSala = await db.collection('salas').doc(idSala).get();
        if (!verificarSala.exists) {
            return res.status(400).json({
                mensagem: 'Sala não existe',
            })
        }
        const verificarUsuario = await db.collection('usuarios').doc(idUsuario).get();
        if (!verificarUsuario.exists) {
            return res.status(400).json({
                mensagem: 'Usuário não existe',
            })
        }
        if (verificarUsuario.data().Tipo !== 'aluno' || verificarSala.id !== verificarUsuario.data().SalaId) {
            return res.status(400).json({
                mensagem: 'Você não tem permissão para criar respostas nesta sala',
            })
        }

        const verificarResposta = await db.collection('respostas')
            .where('StudentId', '==', idUsuario)
            .where('ActivitId', '==', activiId)
            .get()

        if (!verificarResposta.empty) {
            return res.status(400).json({
                mensagem: 'Você já enviou uma resposta para essa atividade'
            })
        }

        const alunoData = await db.collection('alunos').doc(idUsuario).get();
        const alunoNome = alunoData.exists ? alunoData.data().Nome : 'Aluno';

        const novaResposta = await db.collection('respostas').add({
            SalaId: idSala,
            StudentId: idUsuario,
            StudentNome: alunoNome,
            ActivitId: activiId,
            CriadoEm: new Date()
        });

        io.to(`sala:${idSala}`).emit('resposta:atualizada', {
            salaId: idSala,
            activiId: activiId
        });

        return res.status(200).json({
            mensagem: 'Resposta criada com sucesso',
            respostaId: novaResposta.id
        })
    } catch (error) {
        return res.status(500).json({
            mensagem: `Erro ao criar a resposta da atividade: ${error.message}`
        })
    }
})

app.get('/respostas/listar', async (req, res) => {
    const { idUsuario, idSala, activiId } = req.query;

    if (!idUsuario || !idSala || !activiId) {
        return res.status(400).json({
            mensagem: 'Dados insuficientes para listar respostas'
        })
    }

    try {
        const verificarSala = await db.collection('salas').doc(idSala).get();
        if (!verificarSala.exists) {
            return res.status(400).json({
                mensagem: 'Sala não existe',
            });
        }

        const verificarUsuario = await db.collection('usuarios').doc(idUsuario).get();
        if (!verificarUsuario.exists) {
            return res.status(400).json({
                mensagem: 'Usuário não existe',
            });
        }

        const usuarioData = verificarUsuario.data();

        if (usuarioData.SalaId !== idSala) {
            return res.status(400).json({
                mensagem: 'Usuário não pertence a esta sala',
            });
        }

        let query;

        if (activiId) {
            query = db.collection('respostas')
                .where('SalaId', '==', idSala)
                .where('ActivitId', '==', activiId);
        } else {
            query = db.collection('respostas')
                .where('SalaId', '==', idSala);
        }
        if (usuarioData.Tipo === 'aluno') {
            query = query.where('StudentId', '==', idUsuario);
        }

        const respostaAchada = await query.get();
        const respostas = [];

        respostaAchada.forEach(doc => {
            const data = doc.data();
            respostas.push({
                id: doc.id,
                studentId: data.StudentId,
                alunoNome: data.StudentNome,
                activitId: data.ActivitId,
                salaId: data.SalaId,
                criadoEm: data.CriadoEm,
            })
        });

        return res.status(200).json({
            mensagem: 'Respostas listadas com sucesso',
            respostas: respostas
        })
    } catch (error) {
        return res.status(500).json({
            mensagem: `Erro ao listar respostas: ${error.message}`
        })
    }
})


app.delete('/respostas/apagar', async (req, res) => {
    const { idUsuario, respostaId } = req.query;

    if (!idUsuario || !respostaId) {
        return res.status(400).json({
            mensagem: 'Dados insuficientes para apagar resposta'
        })
    }

    try {
        const verificarUsuario = await db.collection('usuarios').doc(idUsuario).get();
        if (!verificarUsuario.exists) {
            return res.status(400).json({
                mensagem: 'Usuário não existe',
            })
        }

        const verificarResposta = await db.collection('respostas').doc(respostaId).get();
        if (!verificarResposta.exists) {
            return res.status(400).json({
                mensagem: 'Resposta não existe',
            })
        }

        const respostaData = verificarResposta.data();
        const usuarioData = verificarUsuario.data();

        if (usuarioData.Tipo === 'aluno') {
            if (respostaData.StudentId !== idUsuario) {
                return res.status(400).json({
                    mensagem: 'Você só pode apagar suas próprias respostas',
                })
            }

            if (respostaData.SalaId !== usuarioData.SalaId) {
                return res.status(400).json({
                    mensagem: 'Você não tem permissão para apagar esta resposta',
                })
            }
        }
        else if (usuarioData.Tipo === 'professor') {
            const verificarSala = await db.collection('salas').doc(respostaData.SalaId).get();
            if (!verificarSala.exists || verificarSala.data().ProfessorId !== idUsuario) {
                return res.status(400).json({
                    mensagem: 'Você só pode apagar respostas da sua sala',
                })
            }
        } else {
            return res.status(400).json({
                mensagem: 'Tipo de usuário não permitido para apagar respostas',
            })
        }

        await db.collection('respostas').doc(respostaId).delete();


        io.to(`sala:${respostaData.SalaId}`).emit('resposta:atualizada', {
            salaId: respostaData.SalaId,
            activiId: respostaData.ActivitId
        });

        return res.status(200).json({
            mensagem: 'Resposta apagada com sucesso',
        })
    } catch (error) {
        return res.status(500).json({
            mensagem: `Erro ao apagar resposta: ${error.message}`
        })
    }
})

app.get('/respostas/porAtividade', async (req, res) => {
    const { idUsuario, activiId } = req.query;

    if (!idUsuario || !activiId) {
        return res.status(400).json({
            mensagem: 'Dados insuficientes para listar respostas da atividade'
        })
    }

    try {
        const verificarUsuario = await db.collection('usuarios').doc(idUsuario).get();
        if (!verificarUsuario.exists || verificarUsuario.data().Tipo !== 'professor') {
            return res.status(400).json({
                mensagem: 'Apenas professores podem ver todas as respostas de uma atividade',
            })
        }

        const verificarAtividade = await db.collection('atividades').doc(activiId).get();
        if (!verificarAtividade.exists) {
            return res.status(400).json({
                mensagem: 'Atividade não existe',
            })
        }

        const atividadeData = verificarAtividade.data();

        const verificarSala = await db.collection('salas').doc(atividadeData.SalaId).get();

        if (!verificarSala.exists || verificarSala.data().ProfessorId !== idUsuario) {
            return res.status(400).json({
                mensagem: 'Você só pode ver respostas das atividades da sua sala',
            })
        }

        const todasRespostas = await db.collection('respostas')
            .where('ActivitId', '==', activiId)
            .get();

        const respostas = [];
        const alunosRespondidos = new Set();

        todasRespostas.forEach(doc => {
            const data = doc.data();
            alunosRespondidos.add(data.StudentId);
            respostas.push({
                id: doc.id,
                studentId: data.StudentId,
                alunoNome: data.StudentNome,
                criadoEm: data.CriadoEm,
            })
        });

        const alunosInfo = [];
        for (const alunoId of alunosRespondidos) {
            const alunoDoc = await db.collection('alunos').doc(alunoId).get();
            if (alunoDoc.exists) {
                alunosInfo.push({
                    id: alunoId,
                    nome: alunoDoc.data().Nome
                });
            }
        }

        return res.status(200).json({
            mensagem: 'Respostas da atividade listadas com sucesso',
            totalRespostas: respostas.length,
            respostas: respostas,
            alunos: alunosInfo
        })
    } catch (error) {
        return res.status(500).json({
            mensagem: `Erro ao listar respostas da atividade: ${error.message}`
        })
    }
})

server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    open(`http://localhost:${PORT}`);
});