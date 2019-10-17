import { parse as setCookieParser } from 'set-cookie-parser';
import { randomStr } from '@/utils/string';
import { addParams } from '@/utils/url';

const KEY = 'rc_nonce';
const BASE_SCOPES = ['read:user', 'read:org', 'user:email'];

const ERR_NONCE = 'nonce';
const ERR_CLIENT = 'client';
const ERR_SERVER = 'server';

export const state = function() {
  return {
    loggedIn:  false,
    principal: null,
  };
};

export const getters = {
  loggedIn() {
    return state.loggedIn;
  },

  principal(state) {
    return state.principal;
  }
};

export const mutations = {
  loggedInAs(state, principal) {
    state.loggedIn = true;
    state.principal = principal;

    this.$cookies.remove(KEY);
  },

  loggedOut(state) {
    if ( typeof window !== 'undefined' ) {
      window.$nuxt.$disconnect();
    }

    state.loggedIn = false;
    state.principal = null;
  },
};

export const actions = {
  async getAuthProvider({ dispatch }) {
    const authConfig = await dispatch('rancher/find', {
      type: 'githubProvider',
      id:   'github',
      opt:  { url: '/v3-public/authProviders/github' }
    }, { root: true });

    return authConfig;
  },

  async redirectToGithub({ state, commit, dispatch }, opt = {}) {
    const authConfig = await dispatch('getAuthProvider');

    const nonce = randomStr(16);

    this.$cookies.set(KEY, nonce, {
      path:     '/',
      sameSite: true,
      secure:   true,
    });

    const scopes = BASE_SCOPES.slice();

    if ( opt && opt.scopes ) {
      scopes.push(...opt.scopes);
    }
    if (!opt.route) {
      opt.route = '/auth/verify';
    }
    const url = addParams(authConfig.redirectUrl, {
      scope:        [...BASE_SCOPES, ...scopes].join(','),
      redirect_uri: `${ window.location.origin }${ opt.route }${ (window.location.search || '').includes('spa') ? '?spa' : '' }`,
      state:        nonce
    });

    window.location.href = url;
  },

  async verify({ state, commit, dispatch }, { nonce, code }) {
    console.log(`1: nonce ${ nonce }, code: ${ code }`);
    const expect = this.$cookies.get(KEY, { parseJSON: false });

    console.log(`2: Expeect ${ expect }`);

    if ( !expect || expect !== nonce ) {
      return ERR_NONCE;
    }

    const authConfig = await dispatch('getAuthProvider');

    try {
      console.log('3');
      const res = await authConfig.doAction('login', {
        code,
        description:  'Dashboard UI session',
        responseType: 'cookie',
        ttl:          16 * 60 * 60 * 1000,
      });

      console.log('4');

      if ( process.server ) {
        console.log('5');
        const parsed = setCookieParser(res._headers['set-cookie'] || []);

        console.log(`6, parsed: ${ parsed }`);

        for ( const opt of parsed ) {
          const key = opt.name;
          const value = opt.value;

          delete opt.name;
          delete opt.value;

          opt.encode = x => x;

          console.log(`7, set(${ key }, ${ value }, ${ opt })`);
          this.$cookies.set(key, value, opt);
        }
        console.log('8');
      }

      console.log('9');

      return true;
    } catch (err) {
      console.log('10', err);
      console.log('11', err.resposne);
      if ( err.response.status >= 400 && err.response.status <= 499 ) {
        return ERR_CLIENT;
      }

      console.log('12');

      return ERR_SERVER;
    }
  },

  async logout({ dispatch, commit }) {
    try {
      await dispatch('rancher/request', {
        url:     '/v3/tokens?action=logout',
        method:  'post',
        data:    {},
        headers: { 'Content-Type': 'application/json' }
      }, { root: true });
    } catch (e) {
    }

    commit('loggedOut');
  }
};