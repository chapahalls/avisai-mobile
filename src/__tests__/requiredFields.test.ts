import { describe, expect, it } from 'vitest';
import { REQUIRED_FIELDS, extractFields, missingFields } from '../features/report/rules/requiredFields';

describe('requiredFields rules (R1)', () => {
  it('rejeita "tudo certo" e "all good" sozinhos sem preencher nenhum campo', () => {
    expect(extractFields('pickup', 'Tudo certo')).toEqual({});
    expect(extractFields('pickup', 'All good')).toEqual({});
    expect(extractFields('checkin', 'Tudo certo por aqui')).toEqual({});
    expect(extractFields('checkin', 'Everything is fine')).toEqual({});
    expect(extractFields('unload', 'Tudo certo')).toEqual({});
    expect(extractFields('unload', 'All good')).toEqual({});
  });

  it('extrai campos obrigatorios em pt-BR para pickup, checkin e unload', () => {
    const pickup = extractFields('pickup', 'Peguei a carga e o caminhão está ok');
    expect(pickup).toHaveProperty('carga');
    expect(pickup).toHaveProperty('caminhao');
    expect(missingFields('pickup', pickup)).toEqual([]);

    const checkin = extractFields('checkin', 'Carga inteira, sem avaria e viagem tranquila');
    expect(checkin).toHaveProperty('status_carga');
    expect(checkin).toHaveProperty('avarias');
    expect(checkin).toHaveProperty('ocorrencias');
    expect(missingFields('checkin', checkin)).toEqual([]);

    const unload = extractFields('unload', 'Descarreguei agora');
    expect(unload).toHaveProperty('descarga');
    expect(missingFields('unload', unload)).toEqual([]);
  });

  it('extrai campos obrigatorios em ingles (en) para pickup, checkin e unload', () => {
    const pickup = extractFields('pickup', 'Picked up the cargo, truck is ok');
    expect(pickup).toHaveProperty('carga');
    expect(pickup).toHaveProperty('caminhao');
    expect(missingFields('pickup', pickup)).toEqual([]);

    const checkin = extractFields('checkin', 'Cargo intact, no damage, smooth trip');
    expect(checkin).toHaveProperty('status_carga');
    expect(checkin).toHaveProperty('avarias');
    expect(checkin).toHaveProperty('ocorrencias');
    expect(missingFields('checkin', checkin)).toEqual([]);

    const unload = extractFields('unload', 'Unloaded');
    expect(unload).toHaveProperty('descarga');
    expect(missingFields('unload', unload)).toEqual([]);
  });

  it('lista apenas os campos que faltaram em multiplos turnos (pickup -> checkin -> unload)', () => {
    expect(REQUIRED_FIELDS.pickup).toEqual(['carga', 'caminhao']);
    const turn1 = extractFields('pickup', 'Peguei a carga');
    expect(missingFields('pickup', turn1)).toEqual(['caminhao']);

    const turn2 = { ...turn1, ...extractFields('pickup', 'Caminhão ok') };
    expect(missingFields('pickup', turn2)).toEqual([]);

    const checkin1 = extractFields('checkin', 'Arrived, cargo ok');
    expect(missingFields('checkin', checkin1)).toEqual(['avarias', 'ocorrencias']);

    const checkin2 = { ...checkin1, ...extractFields('checkin', 'No damage, smooth trip') };
    expect(missingFields('checkin', checkin2)).toEqual([]);

    const unload = extractFields('unload', 'Finished unloading');
    expect(missingFields('unload', unload)).toEqual([]);
  });
});
