/**
 * Teste de regressão do bug corrigido no commit `663b1b3`: a importação de
 * contatos fazia UM ÚNICO `writeBatch`, e o Firestore aceita no máximo 500
 * operações por batch — listas maiores eram truncadas SILENCIOSAMENTE (sem
 * erro, sem aviso; o resto dos contatos simplesmente sumia). A correção
 * divide em lotes de 400 (margem de segurança) commitados em sequência.
 *
 * Este teste garante que N contatos resultam em `ceil(N / 400)` chamadas de
 * `commit()` — se alguém voltar a usar um único batch, o teste com 900
 * contatos falha.
 */
import { doc, writeBatch, collection } from 'firebase/firestore';
import { importarClientesEmLote, adicionarClienteManual } from '../../src/data/repositories/ClienteContatoRepository';

const mockedDoc = doc as jest.Mock;
const mockedWriteBatch = writeBatch as jest.Mock;
const mockedCollection = collection as jest.Mock;

function contatosFalsos(qtd: number) {
  return Array.from({ length: qtd }, (_, i) => ({ nome: `Cliente ${i}`, telefone: `1199999${String(i).padStart(4, '0')}` }));
}

describe('importarClientesEmLote — regressão do truncamento silencioso acima de 500', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCollection.mockReturnValue({ __ref: 'clientes-collection' });
    mockedDoc.mockReturnValue({ __ref: 'novo-doc' });
  });

  const criarBatchFalso = () => ({ set: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) });

  it('não faz nenhuma chamada quando a lista está vazia', async () => {
    const total = await importarClientesEmLote('barbeiro-1', []);
    expect(total).toBe(0);
    expect(mockedWriteBatch).not.toHaveBeenCalled();
  });

  it('usa um único batch para até 400 contatos', async () => {
    const batch = criarBatchFalso();
    mockedWriteBatch.mockReturnValue(batch);

    const total = await importarClientesEmLote('barbeiro-1', contatosFalsos(400));

    expect(total).toBe(400);
    expect(mockedWriteBatch).toHaveBeenCalledTimes(1);
    expect(batch.set).toHaveBeenCalledTimes(400);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('divide em 2 lotes quando passa de 400 (ex.: 401 contatos)', async () => {
    const batches = [criarBatchFalso(), criarBatchFalso()];
    let call = 0;
    mockedWriteBatch.mockImplementation(() => batches[call++]);

    const total = await importarClientesEmLote('barbeiro-1', contatosFalsos(401));

    expect(total).toBe(401);
    expect(mockedWriteBatch).toHaveBeenCalledTimes(2);
    expect(batches[0].set).toHaveBeenCalledTimes(400);
    expect(batches[1].set).toHaveBeenCalledTimes(1);
    expect(batches[0].commit).toHaveBeenCalledTimes(1);
    expect(batches[1].commit).toHaveBeenCalledTimes(1);
  });

  it('divide 900 contatos em 3 lotes sequenciais (nenhum contato descartado)', async () => {
    const criados: Array<ReturnType<typeof criarBatchFalso>> = [];
    mockedWriteBatch.mockImplementation(() => {
      const b = criarBatchFalso();
      criados.push(b);
      return b;
    });

    const total = await importarClientesEmLote('barbeiro-1', contatosFalsos(900));

    expect(total).toBe(900);
    expect(mockedWriteBatch).toHaveBeenCalledTimes(3);
    const totalSetsChamados = criados.reduce((acc, b) => acc + b.set.mock.calls.length, 0);
    expect(totalSetsChamados).toBe(900); // nenhum contato foi descartado
    criados.forEach((b) => expect(b.commit).toHaveBeenCalledTimes(1));
  });

  it('grava o campo aniversario só quando presente (evita undefined explícito no Firestore)', async () => {
    const batch = criarBatchFalso();
    mockedWriteBatch.mockReturnValue(batch);

    await importarClientesEmLote('barbeiro-1', [
      { nome: 'Com aniversário', telefone: '11999990000', aniversario: '07-23' },
      { nome: 'Sem aniversário', telefone: '11999990001' },
    ]);

    const [, dadosComAniversario] = batch.set.mock.calls[0];
    const [, dadosSemAniversario] = batch.set.mock.calls[1];
    expect(dadosComAniversario.aniversario).toBe('07-23');
    expect(dadosSemAniversario).not.toHaveProperty('aniversario');
  });
});

describe('adicionarClienteManual', () => {
  it('grava telefone null quando não informado (nunca undefined)', async () => {
    const { addDoc } = require('firebase/firestore');
    (addDoc as jest.Mock).mockResolvedValue({ id: 'novo-id' });
    mockedCollection.mockReturnValue({ __ref: 'clientes-collection' });

    const id = await adicionarClienteManual('barbeiro-1', { nome: 'Sem telefone' });

    expect(id).toBe('novo-id');
    const [, dados] = (addDoc as jest.Mock).mock.calls[0];
    expect(dados.telefone).toBeNull();
  });
});
