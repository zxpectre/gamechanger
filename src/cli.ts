#!/usr/bin/env node  --no-warnings
import {
  apiEncodings,
  apiVersions,
  GCDappConnUrls,
  networks,
  usageMessage
} from './config'
import { EncodingByHeaders } from './encodings/msg'
import handlers from './index'
import {
  APIEncoding,
  APIVersion,
  DefaultAPIEncodings,
  DefaultAPIVersion,
  DefaultNetwork,
  DefaultQRSubTitle,
  DefaultQRTemplate,
  DefaultQRTitle,
  NetworkType,
  SourceType
} from './types'

import meow from 'meow'
import fs from 'fs'
import getStdin from 'get-stdin'

export const cli = meow(usageMessage, {
  help: usageMessage,
  autoHelp: true,
  flags: {
    args: {
      type: 'string',
      alias: 'a'
    },
    file: {
      type: 'string',
      alias: 'f'
    },
    stdin: {
      type: 'string',
      alias: 'i'
    },
    outputFile: {
      type: 'string',
      alias: 'o'
    },
    template: {
      type: 'string',
      alias: 't'
    },
    styles: {
      type: 'string',
      alias: 's'
    },
    apiVersion: {
      type: 'string',
      alias: 'v'
    },
    encoding: {
      type: 'string',
      alias: 'e'
    },
    debug: {
      type: 'boolean',
      alias: 'd'
    }
  }
})

export const sourcesHandlers: SourceType = {
  args: () => Promise.resolve(cli.flags.args),
  file: () => {
    const filename = cli.flags.file
    return new Promise((resolve, reject) => {
      if (typeof filename === 'string') {
        fs.readFile(filename, 'utf8', (err, data) => {
          if (err)
            return reject(new Error('Failed to read from stdin.' + err.message))
          return resolve(data.toString())
        })
      } else {
        return reject(new Error('Undefined file'))
      }
    })
  },
  stdin: () => getStdin(),
  outputFile: () => Promise.resolve(cli.flags.outputFile)
}

export default async function () {
  try {
    process.on('uncaughtException', function (err) {
      console.error('Error: ' + err.message)
      console.error(usageMessage)
    })

    const [network, action, subAction] = cli.input

    const actions = Object.keys(handlers)
    if (!actions.includes(action)) {
      throw new Error('Unknown action')
    }
    const subActions = Object.keys(handlers[action])
    if (!subActions.includes(subAction)) {
      throw new Error(`Unknown sub action for action '${action}'`)
    }

    const source = cli.flags.args ? 'args' : cli.flags.file ? 'file' : 'stdin'
    const debug = !!cli.flags.debug
    const encoding = <APIEncoding>cli.flags.encoding
    const apiVersion = <APIVersion>cli.flags.apiVersion

    const outputFile = cli.flags.outputFile
    const template = <any>cli.flags.template
    const styles = cli.flags.styles

    const sourceResolver = sourcesHandlers[source]
    const actionResolver = handlers[action][subAction]
    //const actionLoader	 = actionsHandlerLoaders[action][subAction];
    //const actionResolver = await actionLoader();

    const input = await sourceResolver()
    const output = await actionResolver({
      network: <NetworkType>network,
      input,
      encoding,
      apiVersion,
      debug,

      outputFile,
      template,
      styles
    })

    if (debug) {
      console.log(
        JSON.stringify(
          {
            input,
            output,
            params: {
              debug,
              action,
              subAction,
              network,
              encoding,
              apiVersion,
              source,

              outputFile,
              template,
              styles
            },
            config: {
              networks,
              actions,
              subActions: { [action]: subActions },
              apiVersions,
              defaults: {
                network: DefaultNetwork,
                encodings: DefaultAPIEncodings,
                apiVersion: DefaultAPIVersion,
                qr: {
                  template: DefaultQRTemplate,
                  title: DefaultQRTitle,
                  subTitle: DefaultQRSubTitle
                }
              },
              apiEncodings,
              gcDappConnUrls: GCDappConnUrls,
              msgHeaders: EncodingByHeaders
            }
          },
          null,
          2
        )
      )
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error('Error: ' + err.message)
      console.error(usageMessage)
    }
    process.exit(1)
  }
}
