/**
 * Cobre as duas funções novas usadas pela InicioScreen (painel-resumo do
 * barbeiro): `listarPorBarbeiroEPeriodo` (resumo "Esta semana") e
 * `contarPendentesDoBarbeiro` (aviso de agendamentos aguardando
 * confirmação). Ambas dependem de índices compostos específicos — este
 * teste garante que a query montada usa exatamente os filtros esperados,
 * então uma mudança que quebre o índice necessário (ver
 * firestore.indexes.json) aparece aqui antes de virar `permission-denied`
 * ou "The query requires an index" em produção.
 */
import { where, getDocs, getCountFromServer } from 'firebase/firestore';
import {
  listarPorBarbeiroEPeriodo,
  contarPendentesDoBarbeiro,
} from '../../src/data/repositories/AgendamentoRepository';

const mockedWhere = where as jest.Mock;
const mockedGetDocs = getDocs as jest.Mock;
const mockedGetCountFromServer = getCountFromServer as jest.Mock;

describe('listarPorBarbeiroEPeriodo', () => {
  beforeEach(() => jest.clearAllMocks());

  it('filtra por barbeiroId e pelo intervalo de data (>= início, <= fim)', async () => {
    mockedGetDocs.mockResolvedValue({
      docs: [{ id: 'a1', data: () => ({ barbeiroId: 'uid1', data: '2026-07-20' }) }],
    });

    const resultado = await listarPorBarbeiroEPeriodo('uid1', '2026-07-19', '2026-07-25');

    expect(resultado).toEqual([{ id: 'a1', barbeiroId: 'uid1', data: '2026-07-20' }]);
    expect(mockedWhere).toHaveBeenCalledWith('barbeiroId', '==', 'uid1');
    expect(mockedWhere).toHaveBeenCalledWith('data', '>=', '2026-07-19');
    expect(mockedWhere).toHaveBeenCalledWith('data', '<=', '2026-07-25');
  });

  it('retorna lista vazia sem tocar o Firestore quando não há barbeiroId', async () => {
    const resultado = await listarPorBarbeiroEPeriodo('', '2026-07-19', '2026-07-25');
    expect(resultado).toEqual([]);
    expect(mockedGetDocs).not.toHaveBeenCalled();
  });
});

describe('contarPendentesDoBarbeiro', () => {
  beforeEach(() => jest.clearAllMocks());

  it('conta via agregação server-side, filtrando barbeiroId + status pendente', async () => {
    mockedGetCountFromServer.mockResolvedValue({ data: () => ({ count: 3 }) });

    const total = await contarPendentesDoBarbeiro('uid1');

    expect(total).toBe(3);
    expect(mockedWhere).toHaveBeenCalledWith('barbeiroId', '==', 'uid1');
    expect(mockedWhere).toHaveBeenCalledWith('status', '==', 'pendente');
  });

  it('retorna 0 sem tocar o Firestore quando não há barbeiroId', async () => {
    const total = await contarPendentesDoBarbeiro(null);
    expect(total).toBe(0);
    expect(mockedGetCountFromServer).not.toHaveBeenCalled();
  });
});
