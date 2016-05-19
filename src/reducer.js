import {
  COLLECTIONS_KEY,
  ITEMS_KEY,
  isEntityExpired,
  getEntityData
} from './utils';

const EXPIRE_SECONDS = 60;

const FETCH_OPERATION = 'fetch';
const UPDATE_OPERATION = 'update';
const CREATE_OPERATION = 'create';
const DELETE_OPERATION = 'delete';

const OPERATION_FLAGS = {
  [FETCH_OPERATION]: 'isFetching',
  [UPDATE_OPERATION]: 'isUpdating',
  [DELETE_OPERATION]: 'isDeleting'
};

const PENDING_REQUESTS = new Map();

export const RECEIVE_ENTITY = 'entities/RECEIVE_ENTITY';
export const REQUEST_ENTITY = 'entities/REQUEST_ENTITY';

export default function reducer(state = {}, action = {}) {
  switch (action.type) {
    case RECEIVE_ENTITY:
      return {
        ...state,
        ...Object.keys(action.result.entities).reduce((types, entityType) => {
          types[entityType] = entityReducer(state[entityType], action, entityType);
          return types;
        }, {  })
      };
    case REQUEST_ENTITY:

    default:
      return state;
  }
}

function entityReducer(entityState = {}, action, entityType){
  return {
    [COLLECTIONS_KEY]: entityCollectionsReducer(entityState[COLLECTIONS_KEY], action, entityType),
    [ITEMS_KEY]: entityItemsReducer(entityState[ITEMS_KEY], action, entityType)
  }
}

function entityItemsReducer(entityItemsState = {}, action, entityType) {
  const itemsData = action.result.entities[entityType];
  return {
    ...entityItemsState,
    ...itemsData.reduce((entities, entityData) => {
      entities[entityData.id] = entityItemReducer(entityItemsState[entityData.id], action, entityType, entityData);
      return entities;
    }, {})
  }
}

function entityItemReducer(entityItemState = {}, action, entityType, entityData) {
  const metadata = {
    isUpdating: false,
    isFetching: false,
    isDeleting: false,
    isDeleted: false,
    ...entityItemState.metadata,
    lastUpdate: new Date().getTime()
  };
  if (!action.payload.isCollection && action.payload.type === entityType && action.payload.id === entityData.id) {
    metadata[OPERATION_FLAGS[action.payload.operation]] = false;
  }
  if (action.payload.operation === DELETE_OPERATION) {
    metadata.isDeleted = true;
  }
  return {
    metadata: metadata,
    data: entityData
  }
}

function entityCollectionsReducer(entityCollectionsState = {}, action, entityType) {
  if (!action.payload.isCollection || action.payload.type !== entityType){
    return entityCollectionsState;
  }
  const collectionData = action.result.result;
  return {
    ...entityCollectionsState,
    [ action.payload.id ]: {
      data: collectionData,
      metadata: {
        isFetching: false,
        lastUpdate: new Date().getTime()
      }
    }
  }
}

export function createItem(type, createPromise){
  return (dispatch, getState) => {
    dispatch(createRequestAction(type, null, false, CREATE_OPERATION));
    return createPromise(dispatch, getState).then((result) => {
      dispatch(createReceiveAction(type, null, false, result, CREATE_OPERATION));
      return getEntityData(getState(), type, result.result, false);
    });
  }
}

export function createLocalItem(type, data) {
  return (dispatch, getState) => {
    dispatch(createReceiveAction(type, null, false, {
      entities: {
        [type] : [data]
      },
      result: data.id
    }, CREATE_OPERATION));
    return data.id;
  }
}

export function deleteItem(type, id, createPromise) {
  return (dispatch, getState) => {
    dispatch(createRequestAction(type, id, false, DELETE_OPERATION));
    return createPromise(dispatch, getState).then((result) => {
      dispatch(createReceiveAction(type, id, false, result, DELETE_OPERATION));
      return result.result;
    });
  }
}

export function deleteLocalItem(type, id) {
  return (dispatch, getState) => {
    dispatch(createReceiveAction(type, null, false, {
      entities: {
        [type]: [{ id }]
      },
      result: id
    }, DELETE_OPERATION));
    return id;
  }
}

export function updateItem(type, id, createPromise){
  return (dispatch, getState) => {
    dispatch(createRequestAction(type, id, false, UPDATE_OPERATION));
    return createPromise(dispatch, getState).then((result) => {
      dispatch(createReceiveAction(type, id, false, result, UPDATE_OPERATION));
      return getEntityData(getState(), type, id, false);
    });
  }
}

export function fetchCollection(type, id, createPromise, options = {}){
  return fetch(type, id, createPromise, true, options);
}

export function fetchItem(type, id, createPromise, options = {}){
  return fetch(type, id, createPromise, false, options);
}

function fetch(type, id, createPromise, isCollection, options = {}) {
  const expiresSeconds = options.expiresSeconds || EXPIRE_SECONDS;
  return (dispatch, getState) => {
    const state = getState();
    const key = getEntityKey(type, id, isCollection);

    if(PENDING_REQUESTS.has(key)){
      return PENDING_REQUESTS.get(key)
    }
    if(!options.force && !isEntityExpired(state, type, id, isCollection, expiresSeconds)){
      return Promise.resolve(getEntityData(state, type, id, isCollection));
    }
    dispatch(createRequestAction(type, id, isCollection, FETCH_OPERATION));
    const promise = createPromise(dispatch, getState)
      .then(
        (result) => {
          dispatch(createReceiveAction(type, id, isCollection, result, FETCH_OPERATION));
          PENDING_REQUESTS.delete(key);
          return getEntityData(getState(), type, id, isCollection);
        },
        (error) => {
          PENDING_REQUESTS.delete(key);
          throw error;
        }
      );

    PENDING_REQUESTS.set(key, promise);
    return promise;
  }
}

function createRequestAction(type, id, isCollection, operation){
  return {
    type: REQUEST_ENTITY,
    payload: { type, id, isCollection, operation}
  }
}

function createReceiveAction(type, id, isCollection, result, operation){
  return {
    type: RECEIVE_ENTITY,
    payload: { type, id, isCollection, operation },
    result
  }
}

function getEntityKey(type, id, isCollection){
  return `${type}-${id}-${isCollection ? 'collection' : 'item'}`;
}