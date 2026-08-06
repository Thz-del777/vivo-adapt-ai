# Vivo AdaptAI — Backend

API em Python/FastAPI que adapta o atendimento da Vivo ao nível de letramento digital do cliente.

## Recursos

- Dados simulados em `app/data/clientes.json`, com consulta opcional ao Supabase.
- Cálculo de ILD e classificação em `iniciante`, `intermediario` ou `avancado`.
- Respostas pela Groq, com fallback seguro por regras quando houver falha.
- `DEMO_MODE=true` para não chamar a Groq.
- Endpoints leves `/health`, `/status` e `/echo` para verificações e cold start.
- Autenticação por e-mail e senha via Supabase Auth.
- Vínculo automático entre cada conta autenticada e seu perfil de cliente.

## Executar localmente

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

A documentação interativa estará em `http://127.0.0.1:8000/docs`.

## Testar

```bash
curl http://127.0.0.1:8000/health
curl -X POST http://127.0.0.1:8000/echo -H "Content-Type: application/json" -d '{"mensagem":"teste"}'
curl -X POST http://127.0.0.1:8000/chat -H "Content-Type: application/json" -d '{"cliente_id":1,"mensagem":"Quero tirar a segunda via da minha fatura"}'
curl -X POST http://127.0.0.1:8000/auth/login -H "Content-Type: application/json" -d '{"email":"cliente@exemplo.com","senha":"sua-senha"}'
pytest
```

Exemplo de resposta do `POST /chat` em modo demonstração:

```json
{
  "cliente_id": 1,
  "nome": "Maria",
  "ild": 25,
  "perfil": "iniciante",
  "resposta": "Claro, vou te ajudar passo a passo...",
  "origem_resposta": "demo"
}
```

Com os dados de exemplo, o cliente `1` tem ILD `25` e perfil `iniciante`. O cálculo começa em 50, soma `acessos_app * 2`, subtrai `chamadas_suporte * 4`, `tempo_medio_tarefa * 2`, `erros * 3` e `tarefas_abandonadas * 5`, limitado entre 0 e 100.

### Evolução do ILD com o uso

Depois do cadastro, o frontend autenticado envia atividades para `POST /eventos`. A API valida a sessão, associa a atividade ao cliente correto e registra tudo em `eventos_digitais`. A operação do banco é atômica e usa `evento_chave` para impedir que uma repetição da mesma requisição altere o ILD duas vezes.

- `acesso_app`: incrementa os acessos uma vez por sessão.
- `tarefa_concluida`: atualiza o tempo médio real das tarefas.
- `erro`: incrementa os erros observados na interface.
- `tarefa_abandonada`: registra uma tarefa iniciada e não concluída.
- `pedido_suporte`: incrementa as solicitações de ajuda humana.
- `acao` e `tarefa_iniciada`: fornecem contexto de uso sem alterar a pontuação isoladamente.

Cada mudança relevante recalcula o ILD e cria uma linha em `historico_ild`. Assim, a próxima mensagem enviada ao chat já usa o perfil atualizado. Os eventos guardam apenas metadados seguros, como página, elemento e origem; valores digitados, senhas e mensagens não são enviados pela telemetria.

## Configurar o `.env`

Copie `.env.example` para `.env`. Nunca versione esse arquivo ou chaves de API.

### Usar somente JSON e modo demonstração

Este é o modo padrão e não faz chamadas externas:

```env
DEMO_MODE=true
USE_SUPABASE=false
```

Os clientes vêm de `app/data/clientes.json` e as respostas são geradas por regras. A resposta terá `origem_resposta: "demo"`.

### Usar Groq

Para gerar respostas reais com Groq, configure uma chave válida e desative o modo demonstração:

```env
DEMO_MODE=false
GROQ_API_KEY=sua_chave_secreta
GROQ_MODEL=llama-3.3-70b-versatile
```

O modelo é lido de `GROQ_MODEL`, sem chave ou modelo fixos no código. Se a chamada falhar — inclusive por chave ausente, indisponibilidade ou resposta vazia — a API responde por regras com `origem_resposta: "fallback"`.

### Usar Supabase

Crie uma tabela `clientes` com os campos `id`, `nome`, `acessos_app`, `chamadas_suporte`, `tempo_medio_tarefa`, `erros`, `tarefas_abandonadas` e `historico_atendimento`. Depois configure:

```env
USE_SUPABASE=true
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=sua_chave_service_role_secreta
```

Com `USE_SUPABASE=true`, a API consulta primeiro a tabela `clientes`. Como o banco está protegido para acesso exclusivo do backend, use a chave `service_role` somente nas variáveis do servidor (Render ou `.env` local); nunca a envie ao frontend. Se o Supabase ficar indisponível, estiver sem credenciais ou não tiver o cliente, a API busca o mesmo ID no JSON local. Com `USE_SUPABASE=false`, usa o JSON diretamente.

### Login

No cadastro, a pessoa responde tres perguntas curtas: frequencia de uso de aplicativos, autonomia para resolver duvidas e facilidade para concluir tarefas. As respostas definem o ILD inicial e criam um registro em `historico_ild` com o motivo `avaliacao_inicial`. Isso nao e uma prova nem uma nota exibida ao usuario; o ILD pode ser recalculado depois com o uso real.

O login usa o **Supabase Auth** e requer `SUPABASE_URL` e `SUPABASE_KEY` configurados. As rotas são:

- `POST /auth/signup`: cria uma conta com `email`, `senha` e, opcionalmente, `nome`.
- `POST /auth/login`: devolve `access_token` e `refresh_token` para um e-mail e senha válidos. O campo `password` também é aceito.
- `GET /auth/me`: valida um token enviado no cabeçalho `Authorization: Bearer <access_token>`.

Se a confirmação de e-mail estiver ativada no painel do Supabase, uma conta nova só poderá entrar depois de confirmar o e-mail. O backend não registra senhas nem tokens nos logs.

Ao criar uma conta, o banco cria automaticamente uma linha em `clientes` e preenche `clientes.auth_user_id` com o ID da conta do Supabase Auth. Assim, uma conta só acessa o próprio perfil: em produção, `POST /chat` exige o cabeçalho `Authorization: Bearer <access_token>` e ignora qualquer `cliente_id` enviado pelo navegador.

No `DEMO_MODE=true`, o chat continua aceitando `cliente_id` sem login para demonstrar o produto. Com login, ele também usa o vínculo da conta normalmente.

### Segurança da conta

A área **Meu perfil > Segurança da conta** permite trocar a senha e consultar os dispositivos conectados. A troca exige a senha atual, encerra as sessões anteriores e requer uma senha com pelo menos 12 caracteres, letra maiúscula, letra minúscula, número e símbolo.

Antes de aceitar uma senha nova, o backend consulta o serviço Pwned Passwords por k-anonimato: somente os 5 primeiros caracteres do hash SHA-1 são enviados, nunca a senha nem o hash completo. Se a senha aparecer em vazamentos conhecidos, ela é recusada. Se esse serviço externo estiver temporariamente indisponível, as regras locais continuam valendo e a conta não fica bloqueada por uma falha externa.

O Supabase oferece também a opção nativa **Leaked password protection**, porém ela está disponível somente nos planos Pro ou superiores. No plano gratuito, a proteção por k-anonimato implementada no backend permanece ativa. Ao migrar o projeto para Pro, habilite a opção adicional em **Authentication > Sign In / Password Security**.

Os dispositivos reconhecidos ficam em `sessoes_dispositivos`, protegida por RLS e acessível somente pelo backend. São armazenados apenas navegador, sistema, tipo do dispositivo e datas de atividade; IP e `user-agent` bruto não são guardados. As rotas são:

- `POST /auth/password/change`: confirma a senha atual e troca por uma senha segura.
- `GET /auth/sessions`: lista os dispositivos conectados da própria conta.
- `DELETE /auth/sessions/{session_id}`: remove o acesso de um dispositivo.
- `POST /auth/sessions/revoke-others`: encerra todas as outras sessões.

Depois de atualizar o código em outro ambiente, aplique a migração `supabase/migrations/20260728_seguranca_dispositivos.sql` antes de iniciar o backend.

### Histórico do atendimento

Quando uma pessoa autenticada envia uma mensagem e `USE_SUPABASE=true`, o backend reutiliza (ou cria) uma conversa aberta em `conversas` e grava a mensagem do cliente e a resposta em `mensagens`. Se houver qualquer falha no Supabase, a resposta do chat continua sendo entregue normalmente. Mensagens de visitantes do modo demonstração não são gravadas no histórico de nenhum cliente.

A página `historico.html` consulta o histórico real pelo backend usando:

- `GET /conversas`: lista somente as conversas da conta autenticada.
- `GET /conversas/{conversa_id}`: devolve os detalhes e mensagens de uma conversa da mesma conta.
- `PATCH /conversas/atual/encerrar`: encerra as conversas abertas da conta, grava `encerrada_em` e impede que o próximo atendimento reutilize a conversa anterior.

As duas rotas exigem `Authorization: Bearer <access_token>`. O frontend não acessa as tabelas ou a chave secreta do Supabase diretamente.

### Conectar o front-end ao backend

Os formulários em `front/Projeto-AdaptAI-main/entrar.html` e `cadastro.html` já chamam, respectivamente, `/auth/login` e `/auth/signup`. Para desenvolvimento local, o arquivo `front/Projeto-AdaptAI-main/api-config.js` aponta para `http://127.0.0.1:8000`.

O chat do front envia o token da sessão automaticamente. Portanto, depois de entrar, não é necessário configurar ou salvar um ID de cliente no navegador.

Após publicar a API no Render, substitua nesse arquivo a URL local pela URL pública do serviço, por exemplo:

```js
window.VIVO_ADAPTAI_API_URL = "https://seu-backend.onrender.com";
```

Não coloque chaves do Supabase no front-end. A sessão de login é guardada somente em `sessionStorage` da aba atual.

## Deploy no Render

1. Envie este projeto a um repositório Git e crie um **Web Service** no Render.
2. Use `pip install -r requirements.txt` como *Build Command*.
3. Use `uvicorn app.main:app --host 0.0.0.0 --port $PORT` como *Start Command*.
4. Em **Environment**, adicione as variáveis de `.env.example`: `ENVIRONMENT=production`, `DEMO_MODE`, `USE_SUPABASE`, `GROQ_API_KEY`, `GROQ_MODEL`, `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `FRONTEND_URL=https://vivo-adapt-ai.vercel.app` e `CORS_ORIGINS=https://vivo-adapt-ai.vercel.app`.
5. Para demonstração, use `DEMO_MODE=true` e `USE_SUPABASE=false`. Para produção, forneça as credenciais necessárias e use `DEMO_MODE=false`.
6. Inclua a URL final do frontend no `CORS_ORIGINS`.

## Painel de atendentes

O dashboard usa a fila real da tabela `solicitacoes_atendimento`. Funcionarios podem visualizar solicitacoes, assumir um atendimento, responder ao cliente e concluir o protocolo. As acoes ficam registradas em `atendimento_eventos`.

O acesso nunca e decidido apenas pelo frontend. Autorize funcionarios por uma destas opcoes:

1. Defina `app_metadata.papel=funcionario` no usuario do Supabase Auth; ou
2. Informe os e-mails verificados na variavel privada do backend:

```env
FUNCIONARIO_EMAILS=atendente@empresa.com,supervisor@empresa.com
```

Depois de alterar a autorizacao, reinicie o backend e faca logout/login novamente para renovar o perfil da sessao. Nunca coloque essa lista ou a chave secreta do Supabase em arquivos publicos do frontend.

## Notificações em tempo real

As notificações usam o Supabase Realtime. Quando uma notificação do usuário conectado é criada ou alterada, o sino, a lista e o aviso na tela são atualizados imediatamente, sem recarregar a página.

O frontend recebe do backend somente `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`, depois de validar a sessão. A chave privada `SUPABASE_KEY` continua exclusivamente no servidor. No Render, copie a chave publicável do Supabase para `SUPABASE_PUBLISHABLE_KEY`.

Se a conexão em tempo real cair, a interface mostra o estado de reconexão e mantém uma atualização de segurança a cada 60 segundos enquanto a página estiver visível.

## Privacidade e dados

A página `privacidade.html` reúne os controles pessoais da conta. Depois de validar a sessão, o usuário pode baixar uma cópia em JSON dos seus dados, alterar consentimentos, apagar o histórico de conversas, revogar todas as sessões ou excluir permanentemente a conta.

As ações destrutivas exigem confirmação explícita. A limpeza usa a frase `APAGAR HISTORICO`; a exclusão usa `EXCLUIR MINHA CONTA` e solicita novamente a senha atual. Senhas, tokens e chaves nunca entram no arquivo exportado nem nos logs.

Os consentimentos ficam registrados na tabela `consentimentos_privacidade`, protegida por RLS e sem acesso direto para `anon` ou `authenticated`. Somente o backend com a chave privada realiza as operações após identificar o titular pelo token.
#   V i v o A d a p t A i  
 #   V i v o A d a p t A i  
 
