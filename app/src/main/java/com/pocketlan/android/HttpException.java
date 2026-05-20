package com.pocketlan.android;

final class HttpException extends Exception {
    final int status;

    HttpException(int status, String message) {
        super(message);
        this.status = status;
    }
}
