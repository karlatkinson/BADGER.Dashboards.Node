(function() {
    var listOfConnections = $('#connections');
    var refreshTimer;

    $('#identify-screens').on('click', function() {
        $.get('/admin/command/identify');
    });

    listOfConnections
        .on('click', '.set-name', function() {
            var li = $(this).closest('li');
            var input = $('input', li);
            var deferreds = [];

            $('ul > li', li).each(function() {
                var currentConnection = $(this);
                var sessionId = currentConnection.data('sessionId');

                deferreds = $.get('/admin/command/setName/' + sessionId + '/' + input.val());
            });

            $(this).closest('.edit').addClass('hidden').siblings('.view').removeClass('hidden').find('.connection-name').text(input.val());
            
            $.when.call(this, deferreds).done(function() {
                setTimeout(getConnections, 150);
            });
            
        })
        .on('click', '.change-name', function() {
            $(this).closest('.view').addClass('hidden').siblings('.edit').removeClass('hidden');
        })
        .on('click', '.cancel-change-name', function() {
            $(this).closest('.edit').addClass('hidden').siblings('.view').removeClass('hidden');
        })
        .on('click', '.reload', function() {
            $.get('/admin/command/reload/' + $(this).closest('li').data('sessionId'), function() {
                setTimeout(getConnections, 1500);
            });
        });

    function connectionIsNamed(name) {
        return !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.exec(name) &&
            !/^(\d\d?)|(1\d\d)|(0\d\d)|(2[0-4]\d)|(2[0-5])\.(\d\d?)|(1\d\d)|(0\d\d)|(2[0-4]\d)|(2[0-5])\.(\d\d?)|(1\d\d)|(0\d\d)|(2[0-4]\d)|(2[0-5])$/.exec(name);
    }

    var getConnections = function() {
        clearTimeout(refreshTimer);

        $.get('/admin/connections', function(data) {
            var groupedConnections = _.groupBy(data.connections, function(connection) {
                var isNamed = connectionIsNamed(connection.name);
                
                return isNamed ? connection.name : connection.ip;
            });

            var sortedConnectionNames = _.chain(groupedConnections).map(function(item, key) {
                return key;
            }).sortBy(function(item) {
                var isNamed = connectionIsNamed(item);

                return isNamed ? item.toLowerCase() : 'zzzzzzz' + item.toLowerCase();
            }).value();

            listOfConnections.children('li').addClass('to-delete');

            var lastItem;
            _.each(sortedConnectionNames, function(key) {
                var item = groupedConnections[key];
                var id = key.toLowerCase().replace(/[\W]/g, "");
                var elementId = 'session-' + id;
                var existingItem = $('#' + elementId, listOfConnections).removeClass('to-delete');
                var numberOfIps = _.chain(groupedConnections[key]).countBy('ip').size().value();
                var browsers = _.map(groupedConnections[key], function(item) { 
                    if(item && item.properties && item.properties.userAgent.family) {
                        return item.properties.userAgent.os + ', ' + item.properties.userAgent.device + ', ' + item.properties.userAgent.family + ' (' + item.properties.userAgent.major + ')';
                    }

                    return 'Unknown';
                });
                var resolutions = _.map(groupedConnections[key], function(item) { 
                    return !item || !item.properties || !item.properties.windowSize ? 'Unknown' : item.properties.windowSize.width + 'x' + item.properties.windowSize.height;
                });

                function trimOsString(osString) {
                    return osString.replace(/ [0-9]+\.[0-9]+\.[0-9]+/, "");
                }

                function buildConnectionDetails(isSummary, connection) {
                    var osOrDeviceString = '';

                    if(connection.properties && connection.properties.userAgent) {
                        osOrDeviceString = ' on ' + (connection.properties.userAgent.device.indexOf('Other') > -1 ? connection.properties.userAgent.os : connection.properties.userAgent.device)
                    }

                    return Mustache.render('<div class="connection-details">'
                         + '{{#showIp}}<div><span class="fa fa-sitemap"></span>&nbsp;{{connection.ip}}</div>{{/showIp}}'
                         + '{{#showResolution}}<div><span class="fa fa-arrows-alt"></span>&nbsp;{{connection.properties.windowSize.width}}x{{connection.properties.windowSize.height}}</div>{{/showResolution}}'
                         + '{{#showBrowser}}<div><span class="fa fa-globe"></span>&nbsp;{{connection.properties.userAgent.family}} ({{connection.properties.userAgent.major}}){{osOrDeviceString}}</div>{{/showBrowser}}'
                     + '</div>' , {
                        connection: connection,
                        showIp: (isSummary && numberOfIps === 1) || (!isSummary && numberOfIps !== 1),
                        showBrowser: connection.properties && connection.properties.userAgent && ((isSummary && browsers.length === 1) || (!isSummary && browsers.length !== 1)),
                        showResolution: connection.properties && connection.properties.windowSize && ((isSummary && resolutions.length === 1) || (!isSummary && resolutions.length !== 1)),
                        osOrDeviceString: trimOsString(osOrDeviceString)
                    });
                }

                _.each(groupedConnections[key], function(item, i) {
                    groupedConnections[key][i].details = buildConnectionDetails(false, item);
                });

                if(!existingItem.length) {
                    var bigIconClass = 'fa-question-circle';
                    var lowerCaseName = key.toLowerCase();

                    if(lowerCaseName.indexOf('iPad') > -1 || lowerCaseName.indexOf('tablet') > -1) {
                        bigIconClass = 'fa-tablet';
                    }
                    else if (lowerCaseName.indexOf('machine') > -1){
                        bigIconClass = 'fa-laptop';
                    }
                    else if (lowerCaseName.indexOf('screen') > -1){
                        bigIconClass = 'fa-desktop';
                    }

                    var newItem = $(Mustache.render('<li id="{{connectionGroupId}}">'
                         + '<div class="connection-type"><span class="fa {{bigIconClass}}"></span></div>'
                         + '<div class="view">'
                             + '<div class="change-name" title="Set Computer Name"><div class="fa fa-tags"></div></div>'
                             + '<div class="connection-name">{{connectionGroupName}}</div>'
                             + '{{{connectionDetails}}}'
                         + '</div>'
                         + '<div class="edit hidden">'
                             + '<div class="set-name"><div class="fa fa-check"></div></div>'
                             + '<div class="cancel-change-name"><div class="fa fa-ban"></div></div>'
                             + 'Name: <input type="text" value="{{connectionGroupName}}" />'
                         + '</div>'
                         + '<ul class="connection-list">'
                         + '{{#connections}}'
                             + '<li data-session-id="{{sessionId}}" class="connection-list-item">'
                                 + '<div class="connection-item"><div class="fa fa-plug"></div></div>'
                                 + '<div class="connection-options">'
                                     + '<div class="reload" title="Referesh Screen"><div class="fa fa-refresh"></div></div>'
                                     + '<div class="set-url" title="Set Screen Url"><div class="fa fa-link"></div></div>'
                                 + '</div>'
                                 + '<div>{{sessionId}}</div>'
                                 + '{{{details}}}'
                                 + '<div>Url: {{currentView.url}}</div>'
                             + '</li>'
                         + '{{/connections}}' 
                         + '</ul>'
                         + '</li>', {
                        connectionGroupId: elementId,
                        connectionGroupName: key,
                        connections: groupedConnections[key],
                        connectionDetails: buildConnectionDetails(true, groupedConnections[key][0]),
                        bigIconClass: bigIconClass
                    }));

                    if(lastItem) {
                        newItem.insertAfter(lastItem);
                    }
                    else {
                        newItem.appendTo(listOfConnections);
                    }

                    lastItem = newItem;
                }
                else {
                    var connectionList = $('.connection-list', existingItem).html(Mustache.render('{{#connections}}<li data-session-id="{{sessionId}}">'
                         + '<div>{{sessionId}}{{^singleIp}} ({{ip}}){{/singleIp}}<button class="reload">Reload</button></div>'
                         + '<div>Url: {{currentView.url}}<button class="set-url">Set Url</button></div>'
                         + '</li>{{/connections}}', {
                        connectionGroupId: elementId,
                        connectionGroupName: key,
                        connections: groupedConnections[key],
                        singleIp: singleIp
                    }));

                    lastItem = existingItem;
                }

            });

            $('.to-delete', listOfConnections).remove();

            refreshTimer = setTimeout(getConnections, 10000);
        });
    };

    getConnections();
})();