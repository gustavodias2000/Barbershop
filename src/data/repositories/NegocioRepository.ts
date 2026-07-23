/**
 * NegocioRepository — modelo de "equipe" (multi-profissional).
 *
 * Um negócio agrupa vários documentos `Barbeiro` sob um dono único
 * (`negocios/{negocioId}`, com a subcoleção privada
 * `negocios/{negocioId}/membros/{barbeiroId}` guardando papel e comissão).
 *
 * Profissionais criados pelo dono (Opção A do plano) não têm login próprio:
 * o id do documento `Barbeiro` é gerado pelo Firestore e não corresponde a
 * nenhum uid do Firebase Auth. A permissão de escrita vem de ser dono do
 * negócio (ver firestore.rules), não de `isOwner(barbeiroId)`.
 */
import { db } from '../../../firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { Barbeiro, MembroEquipe, Negocio, PapelEquipe, TipoComissao } from '../../types';
import { getBarbeiro, upsertBarbeiro } from './BarbeiroRepository';

/**
 * Atualiza campos do doc público `barbeiros/{id}` de um profissional da
 * equipe SEM passar pelo `upsertBarbeiro` do BarbeiroRepository — este
 * último sempre grava um campo `uid` igual ao id passado, o que é errado
 * aqui: profissionais criados pelo dono (Opção A) não têm login/uid próprio.
 * Use também para o dono editar nome/especialidade de um membro da equipe.
 */
export async function atualizarProfissional(
  barbeiroId: string,
  dados: Partial<Omit<Barbeiro, 'id' | 'uid'>>,
): Promise<void> {
  await setDoc(doc(db, 'barbeiros', barbeiroId), { ...dados, updatedAt: serverTimestamp() }, { merge: true });
}

const membrosRef = (negocioId: string) =>
  collection(db, 'negocios', negocioId, 'membros');

/**
 * Busca um negócio pelo id.
 */
export async function getNegocio(negocioId?: string | null): Promise<Negocio | null> {
  if (!negocioId) return null;
  const snap = await getDoc(doc(db, 'negocios', negocioId));
  if (!snap.exists()) return null;
  return { ...(snap.data() as Omit<Negocio, 'id'>), id: snap.id };
}

/**
 * Busca o negócio do qual o uid logado é dono (no máximo um, hoje).
 *
 * Antes fazia uma QUERY em `negocios` (where donoUid == uid) — mas o
 * Firestore não consegue provar a regra de segurança de `negocios` para
 * esse tipo de busca (ela depende de uma leitura na subcoleção `membros`
 * sem relação direta com o campo `donoUid` filtrado), e nega a operação
 * inteira mesmo quando o usuário é o dono de verdade (reproduzido em teste
 * real: "Missing or insufficient permissions" logo ao abrir Agenda/Equipe).
 *
 * Em vez disso, busca o `negocioId` já denormalizado no próprio doc
 * `barbeiros/{donoUid}` (gravado por `criarNegocio`) e então busca o
 * negócio por ID conhecido — um `get()` simples, que a regra já suporta.
 */
export async function getNegocioPorDono(donoUid?: string | null): Promise<Negocio | null> {
  if (!donoUid) return null;
  const barbeiro = await getBarbeiro(donoUid);
  if (!barbeiro?.negocioId) return null;
  return getNegocio(barbeiro.negocioId);
}

/**
 * Cria um negócio novo para o barbeiro logado ("transformar em equipe"):
 * cria o doc `negocios/{id}`, registra o dono como membro, e marca o
 * próprio Barbeiro do dono com o `negocioId` recém-criado.
 */
export async function criarNegocio(donoUid: string, nome: string): Promise<Negocio> {
  const negocioDoc = await addDoc(collection(db, 'negocios'), {
    donoUid,
    nome,
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(membrosRef(negocioDoc.id), donoUid), {
    id: donoUid,
    barbeiroId: donoUid,
    papel: 'dono' as PapelEquipe,
    ativo: true,
    createdAt: serverTimestamp(),
  });

  await upsertBarbeiro(donoUid, { negocioId: negocioDoc.id, negocioNome: nome });

  return { id: negocioDoc.id, donoUid, nome };
}

/**
 * Lista os membros (profissionais) de um negócio.
 */
export async function listarMembros(negocioId?: string | null): Promise<MembroEquipe[]> {
  if (!negocioId) return [];
  const snap = await getDocs(membrosRef(negocioId));
  return snap.docs.map((d) => ({ ...(d.data() as Omit<MembroEquipe, 'id'>), id: d.id }));
}

/**
 * Busca a config de um membro específico (ex.: comissão).
 */
export async function getMembro(
  negocioId?: string | null,
  barbeiroId?: string | null,
): Promise<MembroEquipe | null> {
  if (!negocioId || !barbeiroId) return null;
  const snap = await getDoc(doc(membrosRef(negocioId), barbeiroId));
  if (!snap.exists()) return null;
  return { ...(snap.data() as Omit<MembroEquipe, 'id'>), id: snap.id };
}

/**
 * Atualiza dados do membro (ativo/inativo, comissão). Merge parcial.
 */
export async function upsertMembro(
  negocioId: string,
  barbeiroId: string,
  dados: Partial<Omit<MembroEquipe, 'id' | 'barbeiroId'>>,
): Promise<void> {
  await setDoc(
    doc(membrosRef(negocioId), barbeiroId),
    { id: barbeiroId, barbeiroId, ...dados, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Define/atualiza a comissão de um profissional.
 */
export async function definirComissao(
  negocioId: string,
  barbeiroId: string,
  tipo: TipoComissao,
  valor: number,
): Promise<void> {
  await upsertMembro(negocioId, barbeiroId, {
    comissaoTipo: tipo,
    comissaoPercentual: tipo === 'percentual' ? valor : undefined,
    comissaoFixaCentavos: tipo === 'fixo' ? valor : undefined,
  });
}

/**
 * Lista os profissionais (vitrine) que pertencem a um negócio.
 */
export async function listarProfissionaisDoNegocio(
  negocioId?: string | null,
): Promise<Barbeiro[]> {
  if (!negocioId) return [];
  const q = query(collection(db, 'barbeiros'), where('negocioId', '==', negocioId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Barbeiro, 'id'>), id: d.id }));
}

/**
 * Cria um novo profissional dentro do negócio (sem login próprio — Opção A).
 * O dono é quem preenche nome/especialidade; agenda e serviços são
 * configurados depois, nas telas de sempre, com `profissionalId` setado.
 */
export async function criarProfissional(
  negocioId: string,
  dados: { nome: string; especialidade?: string },
): Promise<Barbeiro> {
  const negocio = await getNegocio(negocioId);
  const novoDoc = doc(collection(db, 'barbeiros'));
  const barbeiro: Barbeiro = {
    id: novoDoc.id,
    nome: dados.nome,
    // Campos opcionais só entram quando definidos: o Firestore rejeita
    // `undefined` explícito em setDoc/addDoc.
    ...(dados.especialidade ? { especialidade: dados.especialidade } : {}),
    negocioId,
    ...(negocio?.nome ? { negocioNome: negocio.nome } : {}),
    ativo: true,
  };
  await setDoc(novoDoc, { ...barbeiro, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  await setDoc(doc(membrosRef(negocioId), novoDoc.id), {
    id: novoDoc.id,
    barbeiroId: novoDoc.id,
    papel: 'profissional' as PapelEquipe,
    ativo: true,
    createdAt: serverTimestamp(),
  });

  return barbeiro;
}

/**
 * Ativa/desativa um profissional (some da vitrine, mas o histórico de
 * agendamentos é preservado — nunca apagamos o documento).
 */
export async function definirAtivoProfissional(
  negocioId: string,
  barbeiroId: string,
  ativo: boolean,
): Promise<void> {
  await upsertMembro(negocioId, barbeiroId, { ativo });
  // Espelha no doc público para a vitrine do cliente poder filtrar sem
  // precisar ler a subcoleção privada de membros.
  await atualizarProfissional(barbeiroId, { ativo });
}
