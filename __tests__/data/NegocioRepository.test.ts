/**
 * Teste de regressão do bug crítico da sessão 23/07/2026: `getNegocioPorDono`
 * derrubava Agenda/Equipe/Comissões/Cadastrar Profissional para TODO
 * barbeiro porque fazia uma QUERY (`where donoUid == uid`) em `negocios`,
 * que o Firestore não consegue autorizar para listas (só para `get()` por
 * ID conhecido) — ver firestore.rules e NegocioRepository.ts para o
 * histórico completo.
 *
 * A correção trocou a query por dois `get()` simples: primeiro busca
 * `barbeiros/{uid}.negocioId` (denormalizado), depois `negocios/{negocioId}`
 * por ID. Este teste existe especificamente para impedir que alguém
 * reintroduza a query antiga sem perceber a regressão — se `query`/`where`
 * voltarem a ser chamados aqui, o teste falha.
 */
import { getDoc, query, where, getDocs } from 'firebase/firestore';
import { getNegocioPorDono } from '../../src/data/repositories/NegocioRepository';
import CacheService from '../../src/services/CacheService';

const mockedGetDoc = getDoc as jest.Mock;
const mockedQuery = query as jest.Mock;
const mockedWhere = where as jest.Mock;
const mockedGetDocs = getDocs as jest.Mock;

describe('getNegocioPorDono — regressão do bug de permission-denied', () => {
  beforeEach(() => {
    CacheService.clear();
    jest.clearAllMocks();
  });

  it('busca via dois get() por ID (barbeiro -> negocioId -> negocio), nunca via query/where', async () => {
    mockedGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'dono-uid',
        data: () => ({ nome: 'João', negocioId: 'negocio-1' }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'negocio-1',
        data: () => ({ donoUid: 'dono-uid', nome: 'Barbearia do João' }),
      });

    const negocio = await getNegocioPorDono('dono-uid');

    expect(negocio).toEqual({ id: 'negocio-1', donoUid: 'dono-uid', nome: 'Barbearia do João' });
    expect(mockedGetDoc).toHaveBeenCalledTimes(2);
    // A regressão que causou o bug era exatamente isto: uma query de lista
    // em `negocios`. Se voltar a acontecer, este teste denuncia.
    expect(mockedQuery).not.toHaveBeenCalled();
    expect(mockedWhere).not.toHaveBeenCalled();
    expect(mockedGetDocs).not.toHaveBeenCalled();
  });

  it('retorna null sem tocar o Firestore quando não há uid', async () => {
    const negocio = await getNegocioPorDono(null);
    expect(negocio).toBeNull();
    expect(mockedGetDoc).not.toHaveBeenCalled();
  });

  it('retorna null quando o barbeiro não tem negocioId (profissional solo)', async () => {
    mockedGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'solo-uid',
      data: () => ({ nome: 'Barbeiro Solo' }), // sem negocioId
    });

    const negocio = await getNegocioPorDono('solo-uid');

    expect(negocio).toBeNull();
    // Não deveria nem tentar buscar o negócio se não há negocioId.
    expect(mockedGetDoc).toHaveBeenCalledTimes(1);
  });
});
