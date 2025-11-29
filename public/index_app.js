angular.module('meltdownApp', [])
  .factory('myHttpInterceptor', function ($q) {
        return {
            'request': function(config) {
              config.headers['Authorization'] = (localStorage.getItem('token') || '').trim();
              return config;
            },
            // Optional method to handle successful responses
            response: function (response) {
                // Do something with the successful response
                // For example, modify data, add properties, or log
                return response; // Always return the response or a promise resolving to it
            },

            // Optional method to handle error responses
            responseError: function (rejection) {
                // Do something with the error response
                // For example, display error messages, redirect to login, or retry
                console.error('Error response intercepted:', rejection);
                if (rejection.status === 401) {
                  localStorage.removeItem('token');
                  window.location.href='/login';
                }
                
                return $q.reject(rejection); // Always return a rejected promise
            }
        };
  })
  .config(function ($httpProvider) {
      $httpProvider.interceptors.push('myHttpInterceptor');
  })
  .controller('MainController', ['$http', '$timeout', function ($http, $timeout) {
    const vm = this;
    vm.username = (localStorage.getItem('username') || '').trim();
    vm.authToken = (localStorage.getItem('token') || '').trim();
    if (!vm.authToken) {
      window.location.href='/login';
    }
    if (vm.username) {
      vm.usernameInput = vm.username;
    }
    vm.tables = [];

    vm.quit = function () {
      $http.get('/user/quit').then(() => {
        vm.websocket.close();
        setTimeout(() => {
          localStorage.removeItem('username');
          localStorage.removeItem('token');
          window.location.href='/';
        }, 500);
      });
    };

    vm.finish = function () {
      $http.get('/user/finish').then((response) => {
        vm.refreshTables();
      });
    };

    vm.ready = function (ready) {
      this.changeUserState({ready});
    };
    vm.canPlayTarot = function (canPlayTarot) {
      this.changeUserState({canPlayTarot});
    };
    vm.canPlayTwoTables = function (canPlayTwoTables) {
      this.changeUserState({canPlayTwoTables});
    };
    vm.changeUserState= function(body) {
      $http.post('/user/changeUserState',body).then(() => {
        vm.refreshTables();
      });
    }

    vm.refreshTables = function () {
      return $http.get('/tables').then((resp) => {
        const tablesData = resp.data;
        vm.tables = tablesData.map((fullTable) => {
          let users = [];
          for (var team of fullTable.teams) {
            users = [...users, ...team.users.map((user) => {
              return {
                ...user,
                team: team.name
              };
            })];
          }
          const readyCount = users.filter(u => u.ready).length;
          return {name:fullTable.table.name, users: users, readyCount };
        });
      });
    };

    vm.connectWebsocket = function () {
      const scheme = location.protocol === 'http:' ? 'ws://' : 'wss://';
      const ws = new WebSocket(scheme + location.host + '/socket?auth_token=' + encodeURIComponent(vm.authToken));
      vm.websocket = ws;

      ws.onmessage = (event) => {
        vm.refreshTables();
      };

      ws.onerror = () => ws.close();

      ws.onclose = () => {
        $timeout(vm.connectWebsocket, 1000);
      };
    };

    $http.get('/me').then((response) => {
      vm.user = response.data;
    });
    vm.refreshTables().then(() => {
      vm.connectWebsocket();
    });
  }]);