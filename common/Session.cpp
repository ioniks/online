/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "Session.hpp"
#include "config.h"

#include <sys/stat.h>
#include <sys/types.h>
#include <ftw.h>
#include <utime.h>

#include <cassert>
#include <cstring>
#include <fstream>
#include <iostream>
#include <iterator>
#include <map>
#include <memory>
#include <mutex>
#include <set>

#include <Poco/Exception.h>
#include <Poco/Net/Socket.h>
#include <Poco/Path.h>
#include <Poco/String.h>
#include <Poco/StringTokenizer.h>
#include <Poco/URI.h>

#include "Common.hpp"
#include "IoUtil.hpp"
#include "Protocol.hpp"
#include <LOOLWebSocket.hpp>
#include "Log.hpp"
#include "TileCache.hpp"
#include "Util.hpp"
#include "Unit.hpp"

using namespace LOOLProtocol;

using Poco::Exception;
using Poco::Net::Socket;
using Poco::Net::WebSocket;
using Poco::StringTokenizer;

Session::Session(const std::string& name, const std::string& id, const std::shared_ptr<LOOLWebSocket>& ws) :
    _id(id),
    _name(name),
    _ws(ws),
    _disconnected(false),
    _isActive(true),
    _lastActivityTime(std::chrono::steady_clock::now()),
    _isCloseFrame(false),
    _docPassword(""),
    _haveDocPassword(false),
    _isDocPasswordProtected(false)
{
}

Session::~Session()
{
}

bool Session::sendTextFrame(const char* buffer, const int length)
{
    LOG_TRC(getName() << ": Send: " << getAbbreviatedMessage(buffer, length));
    try
    {
        std::unique_lock<std::mutex> lock(_mutex);

        if (!_ws || _ws->poll(Poco::Timespan(0), Socket::SelectMode::SELECT_ERROR))
        {
            LOG_ERR(getName() << ": Bad socket while sending [" << getAbbreviatedMessage(buffer, length) << "].");
            return false;
        }

        _ws->sendFrame(buffer, length);
        return true;
    }
    catch (const Exception& exc)
    {
        LOG_ERR("Session::sendTextFrame: Exception: " << exc.displayText() <<
                (exc.nested() ? "( " + exc.nested()->displayText() + ")" : ""));
    }

    return false;
}

bool Session::sendBinaryFrame(const char *buffer, int length)
{
    LOG_TRC(getName() << ": Send: " << std::to_string(length) << " bytes.");
    try
    {
        std::unique_lock<std::mutex> lock(_mutex);

        if (!_ws || _ws->poll(Poco::Timespan(0), Socket::SelectMode::SELECT_ERROR))
        {
            LOG_ERR(getName() << ": Bad socket while sending binary frame of " << length << " bytes.");
            return false;
        }

        _ws->sendFrame(buffer, length, WebSocket::FRAME_BINARY);
        return true;
    }
    catch (const Exception& exc)
    {
        LOG_ERR("Session::sendBinaryFrame: Exception: " << exc.displayText() <<
                (exc.nested() ? "( " + exc.nested()->displayText() + ")" : ""));
    }

    return false;
}

void Session::parseDocOptions(const std::vector<std::string>& tokens, int& part, std::string& timestamp)
{
    // First token is the "load" command itself.
    size_t offset = 1;
    if (tokens.size() > 2 && tokens[1].find("part=") == 0)
    {
        getTokenInteger(tokens[1], "part", part);
        ++offset;
    }

    for (size_t i = offset; i < tokens.size(); ++i)
    {
        if (tokens[i].find("url=") == 0)
        {
            _docURL = tokens[i].substr(strlen("url="));
            ++offset;
        }
        else if (tokens[i].find("jail=") == 0)
        {
            _jailedFilePath = tokens[i].substr(strlen("jail="));
            ++offset;
        }
        else if (tokens[i].find("authorid=") == 0)
        {
            std::string userId = tokens[i].substr(strlen("authorid="));
            Poco::URI::decode(userId, _userId);
            ++offset;
        }
        else if (tokens[i].find("author=") == 0)
        {
            std::string userName = tokens[i].substr(strlen("author="));
            Poco::URI::decode(userName, _userName);
            ++offset;
        }
        else if (tokens[i].find("timestamp=") == 0)
        {
            timestamp = tokens[i].substr(strlen("timestamp="));
            ++offset;
        }
        else if (tokens[i].find("password=") == 0)
        {
            _docPassword = tokens[i].substr(strlen("password="));
            _haveDocPassword = true;
            ++offset;
        }
    }

    if (tokens.size() > offset)
    {
        if (getTokenString(tokens[offset], "options", _docOptions))
        {
            if (tokens.size() > offset + 1)
                _docOptions += Poco::cat(std::string(" "), tokens.begin() + offset + 1, tokens.end());
        }
    }
}

void Session::disconnect()
{
    if (!_disconnected)
    {
        _disconnected = true;
        shutdown();
    }
}

bool Session::handleDisconnect()
{
    _disconnected = true;
    shutdown();
    return false;
}

void Session::shutdown(Poco::UInt16 statusCode, const std::string& statusMessage)
{
    if (_ws)
    {
        LOG_TRC("Shutting down WS [" << getName() << "] with statusCode [" <<
                statusCode << "] and reason [" << statusMessage << "].");
        _ws->shutdown(statusCode, statusMessage);
    }
}

bool Session::handleInput(const char *buffer, int length)
{
    LOG_CHECK_RET(buffer != nullptr, false);

    try
    {
        std::unique_ptr< std::vector<char> > replace;
        if (UnitBase::get().filterSessionInput(this, buffer, length, replace))
        {
            buffer = replace->data();
            length = replace->size();
        }

        return _handleInput(buffer, length);
    }
    catch (const Exception& exc)
    {
        LOG_ERR("Session::handleInput: Exception while handling [" <<
                getAbbreviatedMessage(buffer, length) <<
                "] in " << getName() << ": " << exc.displayText() <<
                (exc.nested() ? " (" + exc.nested()->displayText() + ")" : ""));
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Session::handleInput: Exception while handling [" <<
                getAbbreviatedMessage(buffer, length) << "]: " << exc.what());
    }

    return false;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
