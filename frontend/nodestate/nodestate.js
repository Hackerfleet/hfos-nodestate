/*
 * HFOS - Hackerfleet Operating System
 * ===================================
 * Copyright (C) 2011-2019 Heiko 'riot' Weinen <riot@c-base.org> and others.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

let humanizeDuration = require('humanize-duration');

/**
 * @ngdoc function
 * @name hfosFrontendApp.controller:NodestateCtrl
 * @description
 * # NodestateCtrl
 * Controller of the hfosFrontendApp
 */
class Nodestate {

    constructor($scope, $rootscope, $modal, navdata, user, objectproxy, socket, menu, $timeout) {
        this.scope = $scope;
        this.rootscope = $rootscope;
        this.$modal = $modal;
        this.navdata = navdata;
        this.user = user;
        this.op = objectproxy;
        this.socket = socket;
        this.menu = menu;
        this.timeout = $timeout;


        this.humanize = humanizeDuration;

        this.now = new Date() / 1000;
        this.lockState = false;
        this.showBoxes = true;

        this.gridsterOptions = {
            // any options that you can set for angular-gridster (see:  http://manifestwebdesign.github.io/angular-gridster/)
            columns: screen.width / 50,
            rowHeight: 75,
            colWidth: 50,
            floating: false,
            draggable: {
                enabled: false
            },
            resizable: {
                enabled: false
            }
        };

        this.gridChangeWatcher = null;

        this.changetimeout = null;

        this.nodestates = {};
        this.old_states = {};

        let self = this;

        this.stopSubscriptions = function () {
            console.log('[STATE] Finally destroying all subscriptions');
            self.stopObserved();
        };

        this.statechange = self.rootscope.$on('$stateChangeStart',
            function (event, toState, toParams, fromState, fromParams, options) {
                console.log('STATE] States: ', toState, fromState);
                if (toState != 'Nodestate') {
                    self.stopSubscriptions();
                }
            });

        this.loginupdate = this.rootscope.$on('User.Login', function () {
            console.log('[STATE] Login successful - fetching nodestate data');
            self.requestNodestates();
        });


        self.scope.$on('$destroy', function () {
            self.stopSubscriptions();
            self.clientconfigupdate();
            self.loginupdate();
            self.statechange();
        });

        this.scope.$on('OP.Update', function (event, uuid, data, schema) {
            if (schema === 'nodestate') {
                console.log('[STATE] Nodestate update received:', uuid, schema, data);
                self.nodestates[uuid] = data;
            }
        });

        this.handleGridChange = function (newVal, oldVal) {
            if (newVal === oldVal) {
                console.log('No actual change');
                return;
            }
            if (self.changetimeout !== null) {
                self.timeout.cancel(self.changetimeout);
            }
            self.changetimeout = self.timeout(function () {
                    self.storeMenuConfig(newVal, oldVal)
                }, 5000
            );
        };

        this.storeMenuConfig = function (newVal, oldVal) {
            console.log('[STATE] Pushing nodestate');
            console.log('oldVal', oldVal, newVal);
            for (let uuid of Object.keys(oldVal)) {
                console.log('uuid:', uuid);
                let oldState = oldVal[uuid];
                let newState = newVal[uuid];
                console.log('old/new:', oldState, newState);
                console.log('comp:', oldState === newState);
                if (JSON.stringify(oldState) !== JSON.stringify(newState)) {
                    delete newVal[uuid]['$$hashKey'];
                    self.op.putObject('nodestate', newVal[uuid]);
                }
            }

            self.changetimeout = null;
        };

        this.requestNodestates = function () {
            console.log('[STATE] Getting list of nodestates');
            self.op.search('nodestate', '*', '*', null, true).then(function (msg) {
                console.log('[STATE] States list incoming msg:', msg);
                let states = msg.data.list;

                for (let item of states) {
                    console.log('[STATE] Analysing ', item);
                    self.nodestates[item.uuid] = item;
                }
            });
        };

        if (this.user.signedin === true) {
            console.log('[STATE] Logged in - fetching nodestate data');
            this.requestNodestates();
        }

        this.stopObserved = function () {
            self.op.unsubscribe(Object.keys(self.nodestates));
        };

        console.log('[STATE] Starting');
    }

    toggle(uuid) {
        if (this.lockState) {
            console.log('[STATE] Not toggling');
            return
        }
        console.log('[STATE] Toggling ', uuid);
        let state = this.nodestates[uuid];
        if (!state.disabled) {
            console.log('[STATE] Toggling:', state.active);
            let request = {
                component: 'isomer.nodestate.manager',
                action: 'toggle',
                data: uuid
            };
            this.socket.send(request);
        } else {
            console.log('[STATE] Button disabled');
        }
    }

    toggleLock() {
        this.lockState = !this.lockState;
        this.gridsterOptions.draggable.enabled = this.lockState;
        this.gridsterOptions.resizable.enabled = this.lockState;
        if (this.lockState) {
            console.log('Enabling gridwatcher');
            //this.gridChangeWatcher = this.scope.$watch('$ctrl.nodestates', this.handleGridChange, true);
            this.old_states = JSON.parse(JSON.stringify(this.nodestates));
        } else {
            this.storeMenuConfig(this.nodestates, this.old_states);
        }
    }
}

Nodestate.$inject = ['$scope', '$rootScope', '$modal', 'navdata', 'user', 'objectproxy', 'socket', 'menu', '$timeout'];

export default Nodestate;
